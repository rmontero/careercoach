'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RTMClient } from 'agora-rtm';
import {
  ApiError,
  fetchStatus,
  requestFeedback,
  startSession,
  stopSession,
  type ServerStatus,
  type StartedSession,
} from '@/lib/api';
import {
  MIN_CANDIDATE_WORDS,
  countCandidateWords,
  type Feedback,
  type TranscriptTurn,
} from '@/lib/feedback';
import { DEFAULT_CONFIG, sessionConfigSchema, type SessionConfig } from '@/lib/interview';
import { useStoredString } from '@/lib/use-stored-string';
import { ActionBar, FeedbackReport } from './FeedbackReport';
import { Orb } from './Orb';
import { SetupScreen } from './SetupScreen';
import type { RoomResult } from './InterviewRoom';

// The Agora web SDKs reference `window`, so they're loaded on the client only.
const RtcProvider = dynamic(() => import('./RtcProvider'), { ssr: false });
const InterviewRoom = dynamic(() => import('./InterviewRoom'), { ssr: false });

interface Outcome {
  config: SessionConfig;
  transcript: TranscriptTurn[];
  durationSeconds: number;
}

type Phase =
  | { name: 'setup' }
  | { name: 'starting' }
  | { name: 'live'; session: StartedSession; rtm: RTMClient; config: SessionConfig }
  | ({ name: 'analyzing' } & Outcome)
  | ({ name: 'report'; feedback: Feedback } & Outcome)
  | ({ name: 'report-error'; message: string; retryable: boolean } & Outcome);

const PREFS_KEY = 'cc:prefs';
const CODE_KEY = 'cc:code';

// Only the choices are remembered between visits; the free-text notes stay in memory.
const prefsSchema = sessionConfigSchema.omit({ context: true });

export default function CoachApp() {
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [context, setContext] = useState('');
  const [startError, setStartError] = useState<string | null>(null);

  const [storedPrefs, setStoredPrefs] = useStoredString('local', PREFS_KEY);
  const [storedCode, setStoredCode] = useStoredString('session', CODE_KEY);
  const accessCode = storedCode ?? '';

  const config = useMemo<SessionConfig>(() => {
    let prefs = {};
    try {
      const parsed = prefsSchema.safeParse(storedPrefs ? JSON.parse(storedPrefs) : null);
      if (parsed.success) prefs = parsed.data;
    } catch {
      // Corrupt stored value: fall back to defaults.
    }
    return { ...DEFAULT_CONFIG, ...prefs, context };
  }, [storedPrefs, context]);

  useEffect(() => {
    fetchStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    // Warm the heavy Agora bundles so "Start" doesn't wait on a chunk download.
    void import('agora-rtc-react').catch(() => {});
    void import('agora-rtm').catch(() => {});
  }, []);

  const updateConfig = (next: SessionConfig) => {
    setContext(next.context ?? '');
    setStoredPrefs(JSON.stringify({ type: next.type, level: next.level, length: next.length }));
  };
  const code = accessCode.trim() || undefined;

  const handleStart = async () => {
    setStartError(null);
    setPhase({ name: 'starting' });
    let started: StartedSession | null = null;
    try {
      started = await startSession(config, code);
      const { default: AgoraRTM } = await import('agora-rtm');
      const rtm: RTMClient = new AgoraRTM.RTM(started.appId, started.uid);
      await rtm.login({ token: started.token });
      await rtm.subscribe(started.channel);
      setPhase({ name: 'live', session: started, rtm, config });
    } catch (error) {
      // Don't leave a billed agent running in an empty channel.
      if (started) void stopSession(started.agentId);
      setStartError(
        error instanceof ApiError ? error.message : 'Could not connect. Check your connection and try again.',
      );
      setPhase({ name: 'setup' });
    }
  };

  const generateFeedback = useCallback(
    async (outcome: Outcome) => {
      if (countCandidateWords(outcome.transcript) < MIN_CANDIDATE_WORDS) {
        setPhase({
          name: 'report-error',
          ...outcome,
          message: 'There wasn’t enough conversation to give useful feedback. Try a longer session and answer out loud.',
          retryable: false,
        });
        return;
      }
      if (status && !status.feedbackConfigured) {
        setPhase({
          name: 'report-error',
          ...outcome,
          message: 'Written feedback isn’t enabled on this server. You can still download your transcript.',
          retryable: false,
        });
        return;
      }
      setPhase({ name: 'analyzing', ...outcome });
      try {
        const feedback = await requestFeedback(
          { config: outcome.config, transcript: outcome.transcript, durationSeconds: outcome.durationSeconds },
          code,
        );
        setPhase({ name: 'report', feedback, ...outcome });
      } catch (error) {
        setPhase({
          name: 'report-error',
          ...outcome,
          message: error instanceof ApiError ? error.message : 'Could not generate feedback. Please try again.',
          retryable: !(error instanceof ApiError && error.status === 422),
        });
      }
    },
    [status, code],
  );

  // The room calls handleFinish exactly once. Keep it stable (reading current values through
  // refs) so the room's effects don't re-run when this component re-renders.
  const live = useRef<Extract<Phase, { name: 'live' }> | null>(null);
  const generateRef = useRef(generateFeedback);
  useEffect(() => {
    live.current = phase.name === 'live' ? phase : null;
    generateRef.current = generateFeedback;
  });

  const handleFinish = useCallback((result: RoomResult) => {
    const room = live.current;
    if (!room) return;
    const outcome: Outcome = { config: room.config, ...result };
    // Leaving the "live" phase unmounts the room, which leaves the channel and frees the mic.
    setPhase({ name: 'analyzing', ...outcome });
    void stopSession(room.session.agentId);
    room.rtm.logout().catch(() => {});
    void generateRef.current(outcome);
  }, []);

  const practiceAgain = () => {
    setStartError(null);
    setPhase({ name: 'setup' });
  };

  if (phase.name === 'live') {
    return (
      <RtcProvider>
        <InterviewRoom session={phase.session} rtmClient={phase.rtm} config={phase.config} onFinish={handleFinish} />
      </RtcProvider>
    );
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main>
        {(phase.name === 'setup' || phase.name === 'starting') && (
          <SetupScreen
            status={status}
            config={config}
            onConfigChange={updateConfig}
            accessCode={accessCode}
            onAccessCodeChange={setStoredCode}
            starting={phase.name === 'starting'}
            error={startError}
            onStart={handleStart}
          />
        )}
        {phase.name === 'analyzing' && <Analyzing />}
        {phase.name === 'report' && (
          <FeedbackReport
            feedback={phase.feedback}
            config={phase.config}
            transcript={phase.transcript}
            durationSeconds={phase.durationSeconds}
            onPracticeAgain={practiceAgain}
          />
        )}
        {phase.name === 'report-error' && (
          <div className="mx-auto max-w-2xl px-5 pt-16 sm:px-8">
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Session ended</h1>
            <p role="alert" className="mt-5 text-lg leading-relaxed text-muted">
              {phase.message}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {phase.retryable && (
                <button
                  type="button"
                  onClick={() => void generateFeedback(phase)}
                  className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Try feedback again
                </button>
              )}
            </div>
            <ActionBar onPracticeAgain={practiceAgain} transcript={phase.transcript} />
          </div>
        )}
      </main>
      {(phase.name === 'setup' || phase.name === 'starting') && <SiteFooter />}
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid size-7 place-items-center rounded-full border border-accent/50">
          <span className="size-3 rounded-full bg-accent" />
        </span>
        <span className="font-serif text-2xl leading-none">career coach</span>
      </div>
      <a
        href="https://www.agora.io/en/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-ink"
      >
        Powered by Agora
      </a>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-10 text-xs text-muted sm:px-8">
      A proof of concept. Live voice runs on{' '}
      <a
        className="underline decoration-line-strong underline-offset-2 hover:text-ink"
        href="https://docs.agora.io/en/ai"
        target="_blank"
        rel="noopener noreferrer"
      >
        Agora’s Conversational AI Engine
      </a>
      ; written feedback is generated by Claude.
    </footer>
  );
}

const ANALYZING_STEPS = [
  'Reviewing your answers…',
  'Checking them against the rubric…',
  'Finding the moments that mattered…',
  'Writing your feedback…',
];

function Analyzing() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZING_STEPS.length - 1)), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rise mx-auto flex max-w-md flex-col items-center px-5 pt-24 text-center">
      <Orb state="thinking" size="150px" />
      <h1 className="mt-10 font-serif text-4xl">Reading between the lines</h1>
      <p role="status" className="mt-3 text-muted">
        {ANALYZING_STEPS[step]}
      </p>
      <p className="mt-6 text-xs text-muted">This usually takes about 20–40 seconds.</p>
    </div>
  );
}
