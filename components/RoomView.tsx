'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { INTERVIEWER_NAME, getLength, getLevel, getType, type SessionConfig } from '@/lib/interview';
import type { Turn } from '@/lib/transcript';
import { AlertIcon, CheckIcon, ChevronDownIcon, MicIcon, MicOffIcon, TranscriptIcon, XIcon } from './icons';
import { Orb, type OrbState } from './Orb';
import { TranscriptPanel } from './TranscriptPanel';

export interface RoomViewProps {
  config: SessionConfig;
  elapsed: number;
  joined: boolean;
  orbState: OrbState;
  stateLabel: string;
  turns: Turn[];
  caption?: string;
  micOn: boolean;
  micAvailable: boolean;
  micBlocked: boolean;
  agentLate: boolean;
  reconnecting: boolean;
  /** Minutes left when the session is close to its cap; otherwise null. */
  minutesLeft: number | null;
  agentIssue: string | null;
  onDismissIssue: () => void;
  interviewComplete: boolean;
  confirmingEnd: boolean;
  onToggleMic: () => void;
  onEnd: () => void;
  /** Non-visual children, e.g. the hidden remote audio players. */
  children?: React.ReactNode;
}

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

/** Pure presentation for the live interview. All Agora state is computed by InterviewRoom. */
export function RoomView(p: RoomViewProps) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  // On phones the panel opens below the fold; bring it into view when the toggle is pressed.
  useEffect(() => {
    if (transcriptOpen) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [transcriptOpen]);
  const type = getType(p.config.type);
  const level = getLevel(p.config.level);
  const length = getLength(p.config.length);

  const progress = Math.min(1, Math.max(0, p.elapsed / (length.minutes * 60)));
  // What the recognizer is hearing right now, so the candidate sees that they're being heard
  // even while the full transcript is collapsed on a phone.
  const lastTurn = p.turns[p.turns.length - 1];
  const heard = lastTurn?.speaker === 'candidate' ? lastTurn.text : null;

  return (
    <div className="rise mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex items-center justify-between gap-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="chip min-w-0">
          <span className="truncate">
            {type.label} · {level.label}
          </span>
        </p>
        <div
          className="glass flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 font-mono text-sm tabular-nums"
          aria-label="Session time"
        >
          <span
            className={cn('size-2 rounded-full', p.joined ? 'bg-accent motion-safe:animate-pulse' : 'bg-line-strong')}
            aria-hidden
          />
          {formatClock(p.elapsed)}
          <span className="hidden text-muted sm:inline">/ ~{length.minutes} min</span>
        </div>
      </header>
      <div
        role="progressbar"
        aria-label="Interview progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="mt-3 h-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full origin-left rounded-full transition-transform duration-1000 ease-linear"
          style={{ transform: `scaleX(${progress})`, background: 'var(--grad-brand)' }}
        />
      </div>

      <main className="flex flex-1 flex-col gap-4 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:py-6">
        <section className="flex flex-1 flex-col items-center justify-center py-2 text-center">
          {/* Sized by the smaller of width and height so a landscape phone still fits the caption on screen. */}
          <Orb state={p.orbState} size="clamp(112px, min(44vw, 30vh), 240px)" />
          <p aria-live="polite" className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {p.stateLabel}
          </p>
          <p className="mt-3 max-w-xl text-balance font-serif text-[1.65rem] leading-snug sm:min-h-[5.5rem] sm:text-3xl">
            {p.caption ?? (
              <span className="text-muted">
                {INTERVIEWER_NAME} will start with a quick hello. Just answer out loud, like a real call.
              </span>
            )}
          </p>
          {/* Fixed two-line slot (2 x leading-5 = h-10) so a longer line can't peek out below the clamp. */}
          <p
            className={cn(
              'mt-3 line-clamp-2 h-10 max-w-md text-sm italic leading-5 text-muted transition-opacity duration-300',
              heard ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={!heard}
          >
            {heard ? <>You: {heard}</> : null}
          </p>

          <div className="mt-2 w-full max-w-xl space-y-2">
            {p.micBlocked && (
              <Banner tone="error">
                We can’t reach your microphone. Allow microphone access in your browser’s address bar, then end this
                session and start again.
              </Banner>
            )}
            {p.agentLate && !p.micBlocked && (
              <Banner tone="warn">
                {INTERVIEWER_NAME} is taking longer than usual to join. If this doesn’t resolve in a few seconds, end the
                session and try again.
              </Banner>
            )}
            {p.reconnecting && <Banner tone="warn">Connection lost. Trying to reconnect…</Banner>}
            {p.minutesLeft !== null && <Banner tone="warn">About {p.minutesLeft} min left in this session.</Banner>}
            {p.agentIssue && (
              <Banner tone="warn" onDismiss={p.onDismissIssue}>
                Heads up: {p.agentIssue}
              </Banner>
            )}
            {p.interviewComplete && <Banner tone="good">That’s the interview. End the session to see your feedback.</Banner>}
          </div>
        </section>

        {/* Phones: collapsed behind a toggle so the stage stays uncluttered. Desktop: always visible. */}
        <button
          type="button"
          className="btn btn-ghost w-full justify-between lg:hidden"
          aria-expanded={transcriptOpen}
          aria-controls="transcript-panel"
          onClick={() => setTranscriptOpen((o) => !o)}
        >
          <span className="flex items-center gap-2.5">
            <TranscriptIcon className="size-4" />
            Transcript
            <span className="font-mono text-xs text-muted">{p.turns.length}</span>
          </span>
          <ChevronDownIcon className={cn('size-4 transition-transform duration-300', transcriptOpen && 'rotate-180')} />
        </button>
        <aside
          id="transcript-panel"
          ref={panelRef}
          className={cn(
            'glass min-h-0 flex-col rounded-3xl p-5 lg:flex lg:h-[calc(100dvh-12rem)]',
            transcriptOpen ? 'flex h-[44dvh]' : 'hidden',
          )}
        >
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted">Live transcript</h2>
          <TranscriptPanel turns={p.turns} interviewerName={INTERVIEWER_NAME} className="min-h-0 flex-1 pr-1" />
        </aside>
      </main>

      {/* The fade band is for phones/tablets where content scrolls beneath the bar; on desktop nothing does. */}
      <footer className="sticky-cta sticky bottom-0 z-20 -mx-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-8 sm:px-8 lg:bg-none lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="hidden text-xs text-muted lg:block">
            Think out loud. Say “give me a moment” if you need time to think.
          </p>
          <div className="flex w-full items-center gap-3 lg:w-auto">
            <button
              type="button"
              onClick={p.onToggleMic}
              disabled={!p.micAvailable}
              aria-pressed={!p.micOn}
              aria-label={p.micOn ? 'Mute microphone' : 'Unmute microphone'}
              className={cn(
                'btn size-14 shrink-0 p-0 lg:w-auto lg:px-5',
                p.micOn ? 'btn-ghost' : 'border border-accent/50 bg-accent-soft text-accent-text',
              )}
            >
              {p.micOn ? <MicIcon /> : <MicOffIcon />}
              <span className="hidden lg:inline">{p.micOn ? 'Mute' : 'Unmute'}</span>
            </button>
            <button
              type="button"
              onClick={p.onEnd}
              className={cn('btn h-14 flex-1 lg:flex-none', p.interviewComplete || p.confirmingEnd ? 'btn-primary' : 'btn-ink')}
            >
              {p.interviewComplete ? 'See my feedback' : p.confirmingEnd ? 'Tap again to end & get feedback' : 'End & get feedback'}
            </button>
          </div>
        </div>
      </footer>

      {p.children}
    </div>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: 'warn' | 'error' | 'good';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rise flex items-start gap-2.5 rounded-2xl px-4 py-3 text-left text-[13px] leading-relaxed',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'error' && 'bg-accent-soft text-accent-text',
        tone === 'good' && 'bg-good-soft text-good',
      )}
    >
      {tone === 'good' ? <CheckIcon className="mt-0.5 size-4 shrink-0" /> : <AlertIcon className="mt-0.5 size-4 shrink-0" />}
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-2.5 grid size-11 shrink-0 place-items-center opacity-70 transition hover:opacity-100"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
