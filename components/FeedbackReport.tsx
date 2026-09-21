'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { READINESS_LABEL, type Feedback, type TranscriptTurn } from '@/lib/feedback';
import { INTERVIEWER_NAME, getLevel, getType, type SessionConfig } from '@/lib/interview';
import { reportToMarkdown, transcriptToText } from '@/lib/report';
import { CheckIcon } from './icons';

interface FeedbackReportProps {
  feedback: Feedback;
  config: SessionConfig;
  transcript: TranscriptTurn[];
  durationSeconds: number;
  onPracticeAgain: () => void;
}

const stagger = (i: number) => ({ '--i': i }) as React.CSSProperties;

export function FeedbackReport({ feedback, config, transcript, durationSeconds, onPracticeAgain }: FeedbackReportProps) {
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const minutes = Math.max(1, Math.round(durationSeconds / 60));

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(feedback, config, transcript, durationSeconds));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context, denied permission); the download still works.
    }
  };

  const togglePlan = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-6 pt-2 sm:px-8 sm:pt-8">
      <header className="glass rise relative overflow-hidden rounded-[28px] p-5 sm:rounded-[36px] sm:p-10">
        {/* Decorative wash; the text sits above it and never relies on it for contrast. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-60 blur-2xl"
          style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--brand-2) 40%, transparent), transparent)' }}
        />
        <div className="relative flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <div className="min-w-0">
            <p className="chip">
              {getType(config.type).label} · {getLevel(config.level).label} · {minutes} min
            </p>
            <h1 className="grad-text mt-4 pr-2 font-serif text-5xl leading-[1.02] tracking-tight sm:text-7xl">
              {READINESS_LABEL[feedback.readiness]}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg">{feedback.summary}</p>
          </div>
          <ScoreRing score={feedback.overall_score} />
        </div>
      </header>

      <section className="mt-10 sm:mt-14" aria-labelledby="scores">
        <h2 id="scores" className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted">
          Scores
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {feedback.dimensions.map((d, i) => (
            <li
              key={d.name}
              className="rise rounded-2xl border border-line bg-surface/70 p-5"
              style={stagger(i)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-medium">{d.name}</h3>
                <span className="font-mono text-sm tabular-nums">
                  {d.score}
                  <span className="text-muted">/5</span>
                </span>
              </div>
              <Bar score={d.score} index={i} />
              <p className="mt-3.5 text-[14px] italic leading-relaxed text-muted">“{d.evidence}”</p>
              <p className="mt-3 text-[14px] leading-relaxed">
                <span className="font-medium">Try: </span>
                {d.advice}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 grid gap-10 sm:mt-14 md:grid-cols-2">
        <section aria-labelledby="strengths">
          <h2 id="strengths" className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-good">
            What went well
          </h2>
          <ul className="space-y-3">
            {feedback.strengths.map((s) => (
              <li key={s} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-good-soft text-good">
                  <CheckIcon className="size-3" />
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="improve">
          <h2 id="improve" className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-accent-text">
            Work on next
          </h2>
          <ul className="space-y-5">
            {feedback.improvements.map((i) => (
              <li key={i.issue} className="text-[15px] leading-relaxed">
                <p className="font-medium">{i.issue}</p>
                <p className="mt-1 text-muted">{i.why_it_matters}</p>
                <p className="mt-2 rounded-xl border border-line bg-surface/70 px-3.5 py-2.5 text-[14px]">
                  <span className="font-medium">Try instead: </span>
                  {i.try_instead}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="glass mt-10 rounded-[28px] p-5 sm:mt-14 sm:p-8" aria-labelledby="plan">
        <h2 id="plan" className="font-serif text-3xl">
          Before your next session
        </h2>
        <p className="mt-1 text-sm text-muted">Tick them off as you go.</p>
        <ul className="mt-4 space-y-1">
          {feedback.practice_plan.map((p, i) => (
            <li key={p}>
              <label className="-mx-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper/60">
                <input type="checkbox" checked={done.has(i)} onChange={() => togglePlan(i)} className="peer sr-only" />
                <span
                  aria-hidden
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-line-strong text-white transition-colors peer-checked:border-transparent peer-checked:bg-[image:var(--grad-btn)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-3 [&>svg]:scale-0 [&>svg]:transition-transform peer-checked:[&>svg]:scale-100"
                >
                  <CheckIcon className="size-3.5" />
                </span>
                <span className={cn('text-[15px] leading-relaxed transition-colors', done.has(i) && 'text-muted line-through')}>
                  {p}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 rounded-2xl border border-line bg-surface/50 px-5">
        <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">Read the full transcript</summary>
        <div className="space-y-3 pb-5 pt-1 text-[14px] leading-relaxed">
          {transcript.map((t, i) => (
            <p key={i}>
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                {t.speaker === 'interviewer' ? INTERVIEWER_NAME : 'You'}
              </span>
              <br />
              {t.text}
            </p>
          ))}
        </div>
      </details>

      <ActionBar onPracticeAgain={onPracticeAgain} onCopy={copyReport} copied={copied} transcript={transcript} />
    </div>
  );
}

/** Animated ring: a gradient arc that draws to score/5 on mount. */
function ScoreRing({ score }: { score: number }) {
  const gradId = useId();
  return (
    <div
      className="relative size-32 shrink-0 self-start sm:size-40 sm:self-auto"
      role="img"
      aria-label={`Overall score ${score} out of 5`}
    >
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-1)" />
            <stop offset="0.55" stopColor="var(--brand-2)" />
            <stop offset="1" stopColor="var(--brand-3)" />
          </linearGradient>
        </defs>
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--line)" strokeWidth="2.6" />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2.6"
          strokeLinecap="round"
          pathLength={100}
          className="ring-fill"
          style={{ '--pct': (score / 5) * 100 } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-4xl tabular-nums sm:text-5xl">
          {score}
          <span className="text-lg text-muted sm:text-xl">/5</span>
        </span>
      </div>
    </div>
  );
}

function Bar({ score, index }: { score: number; index: number }) {
  const fill = score >= 4 ? 'var(--good)' : score === 3 ? 'var(--grad-btn)' : 'var(--warn)';
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
      <div
        className="bar-fill h-full w-full rounded-full"
        style={{ '--v': score / 5, '--i': index, background: fill } as React.CSSProperties}
      />
    </div>
  );
}

export function ActionBar({
  onPracticeAgain,
  onCopy,
  copied,
  transcript,
}: {
  onPracticeAgain: () => void;
  onCopy?: () => void;
  copied?: boolean;
  transcript: TranscriptTurn[];
}) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([transcriptToText(transcript)], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interview-transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex flex-wrap gap-3">
        {onCopy && (
          <button type="button" onClick={onCopy} className={cn('btn btn-ghost', copied && '!border-good !text-good')}>
            {copied ? (
              <>
                <CheckIcon className="size-4" /> Copied
              </>
            ) : (
              'Copy report'
            )}
          </button>
        )}
        {transcript.length > 0 && (
          <button type="button" onClick={download} className="btn btn-ghost">
            Download transcript
          </button>
        )}
      </div>
      {/* Sticks to the bottom on phones so the next step is always in reach; first in the row from `sm`. */}
      <div className="sticky-cta sticky bottom-0 -mx-4 mt-5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:order-first sm:static sm:mx-0 sm:mt-0 sm:bg-none sm:p-0 sm:backdrop-blur-none">
        <button type="button" onClick={onPracticeAgain} className="btn btn-primary w-full min-h-[3.25rem] sm:w-auto">
          Practice again
        </button>
      </div>
    </div>
  );
}
