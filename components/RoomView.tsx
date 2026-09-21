'use client';

import { cn } from '@/lib/cn';
import { INTERVIEWER_NAME, getLength, getLevel, getType, type SessionConfig } from '@/lib/interview';
import type { Turn } from '@/lib/transcript';
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
  const type = getType(p.config.type);
  const level = getLevel(p.config.level);
  const length = getLength(p.config.length);

  return (
    <div className="rise mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 pt-5 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <p className="min-w-0 truncate font-mono text-xs uppercase tracking-[0.16em] text-muted">
          {type.label} · {level.label}
        </p>
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap font-mono text-sm tabular-nums" aria-label="Session time">
          <span
            className={cn('size-2 rounded-full', p.joined ? 'bg-accent motion-safe:animate-pulse' : 'bg-line-strong')}
            aria-hidden
          />
          <span>{formatClock(p.elapsed)}</span>
          <span className="hidden text-muted sm:inline">/ ~{length.minutes} min</span>
        </div>
      </header>

      <main className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <section className="flex flex-col items-center justify-center py-4 text-center">
          <Orb state={p.orbState} size="clamp(160px, 28vw, 240px)" />
          <p aria-live="polite" className="mt-7 font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {p.stateLabel}
          </p>
          <p className="mt-4 min-h-[5.5rem] max-w-xl font-serif text-2xl leading-snug sm:text-[1.75rem]">
            {p.caption ?? (
              <span className="text-muted">
                {INTERVIEWER_NAME} will start with a quick hello. Just answer out loud, like a real call.
              </span>
            )}
          </p>

          <div className="mt-4 w-full max-w-xl space-y-2">
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
            {p.minutesLeft !== null && (
              <Banner tone="warn">
                About {p.minutesLeft} min left in this session.
              </Banner>
            )}
            {p.agentIssue && (
              <Banner tone="warn" onDismiss={p.onDismissIssue}>
                Heads up: {p.agentIssue}
              </Banner>
            )}
            {p.interviewComplete && <Banner tone="good">That’s the interview. End the session to see your feedback.</Banner>}
          </div>
        </section>

        {/* Capped on small screens so the transcript scrolls (and auto-follows) inside its card. */}
        <aside className="flex h-[42dvh] min-h-[220px] flex-col rounded-3xl border border-line bg-surface p-5 lg:h-[calc(100dvh-11.5rem)]">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-muted">Live transcript</h2>
          <TranscriptPanel turns={p.turns} interviewerName={INTERVIEWER_NAME} className="min-h-0 flex-1 pr-1" />
        </aside>
      </main>

      <footer className="sticky bottom-0 -mx-5 border-t border-line bg-paper/90 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="hidden text-xs text-muted sm:block">
            Think out loud. Say “give me a moment” if you need time to think.
          </p>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <button
              type="button"
              onClick={p.onToggleMic}
              disabled={!p.micAvailable}
              aria-pressed={!p.micOn}
              className={cn(
                'rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-40',
                p.micOn ? 'border-line-strong hover:border-ink' : 'border-accent bg-accent-soft text-accent',
              )}
            >
              {p.micOn ? 'Mute' : 'Unmute'}
            </button>
            <button
              type="button"
              onClick={p.onEnd}
              className={cn(
                'flex-1 rounded-full px-6 py-3 text-sm font-medium transition active:scale-[0.99] sm:flex-none',
                p.interviewComplete || p.confirmingEnd ? 'bg-accent text-white hover:opacity-90' : 'bg-ink text-on-ink hover:opacity-90',
              )}
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
        'flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-left text-[13px] leading-relaxed',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'error' && 'bg-accent-soft text-accent',
        tone === 'good' && 'bg-good-soft text-good',
      )}
    >
      <span>{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}
