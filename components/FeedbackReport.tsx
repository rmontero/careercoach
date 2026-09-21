'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { READINESS_LABEL, type Feedback, type TranscriptTurn } from '@/lib/feedback';
import { INTERVIEWER_NAME, getLevel, getType, type SessionConfig } from '@/lib/interview';
import { reportToMarkdown, transcriptToText } from '@/lib/report';

interface FeedbackReportProps {
  feedback: Feedback;
  config: SessionConfig;
  transcript: TranscriptTurn[];
  durationSeconds: number;
  onPracticeAgain: () => void;
}

export function FeedbackReport({ feedback, config, transcript, durationSeconds, onPracticeAgain }: FeedbackReportProps) {
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
      <header className="rise">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Your feedback · {getType(config.type).label} · {getLevel(config.level).label} · {minutes} min
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-7xl">
            {READINESS_LABEL[feedback.readiness]}
          </h1>
          <div className="flex items-center gap-4" aria-label={`Overall score ${feedback.overall_score} out of 5`}>
            <span className="font-mono text-4xl tabular-nums">
              {feedback.overall_score}
              <span className="text-xl text-muted">/5</span>
            </span>
            <Pips score={feedback.overall_score} large />
          </div>
        </div>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed">{feedback.summary}</p>
      </header>

      <section className="rise mt-12" style={{ animationDelay: '80ms' }} aria-labelledby="scores">
        <h2 id="scores" className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted">
          Scores
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {feedback.dimensions.map((d) => (
            <li key={d.name} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-medium">{d.name}</h3>
                <Pips score={d.score} />
              </div>
              <p className="mt-3 text-[14px] italic leading-relaxed text-muted">“{d.evidence}”</p>
              <p className="mt-3 text-[14px] leading-relaxed">
                <span className="font-medium">Try: </span>
                {d.advice}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="rise mt-12 grid gap-10 md:grid-cols-2" style={{ animationDelay: '140ms' }}>
        <section aria-labelledby="strengths">
          <h2 id="strengths" className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-good">
            What went well
          </h2>
          <ul className="space-y-3">
            {feedback.strengths.map((s) => (
              <li key={s} className="flex gap-3 text-[15px] leading-relaxed">
                <span aria-hidden className="mt-0.5 text-good">
                  ✓
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="improve">
          <h2 id="improve" className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-accent">
            Work on next
          </h2>
          <ul className="space-y-5">
            {feedback.improvements.map((i) => (
              <li key={i.issue} className="text-[15px] leading-relaxed">
                <p className="font-medium">{i.issue}</p>
                <p className="mt-1 text-muted">{i.why_it_matters}</p>
                <p className="mt-2 rounded-xl bg-surface px-3.5 py-2.5 text-[14px]">
                  <span className="font-medium">Try instead: </span>
                  {i.try_instead}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rise mt-12 rounded-3xl bg-surface p-6 sm:p-8" style={{ animationDelay: '200ms' }} aria-labelledby="plan">
        <h2 id="plan" className="mb-4 font-serif text-3xl">
          Before your next session
        </h2>
        <ul className="space-y-3">
          {feedback.practice_plan.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] leading-relaxed">
              <span aria-hidden className="mt-1.5 size-3.5 shrink-0 rounded border border-line-strong" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 rounded-2xl border border-line px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium">Read the full transcript</summary>
        <div className="mt-4 space-y-3 text-[14px] leading-relaxed">
          {transcript.map((t, i) => (
            <p key={i}>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                {t.speaker === 'interviewer' ? INTERVIEWER_NAME : 'You'}
              </span>
              <br />
              {t.text}
            </p>
          ))}
        </div>
      </details>

      <ActionBar
        onPracticeAgain={onPracticeAgain}
        onCopy={copyReport}
        copied={copied}
        transcript={transcript}
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
    <div className="mt-10 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onPracticeAgain}
        className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-on-ink transition hover:opacity-90 active:scale-[0.99]"
      >
        Practice again
      </button>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'rounded-full border border-line-strong px-5 py-3 text-sm font-medium transition hover:border-ink',
            copied && 'border-good text-good',
          )}
        >
          {copied ? 'Copied ✓' : 'Copy report'}
        </button>
      )}
      {transcript.length > 0 && (
        <button
          type="button"
          onClick={download}
          className="rounded-full border border-line-strong px-5 py-3 text-sm font-medium transition hover:border-ink"
        >
          Download transcript
        </button>
      )}
    </div>
  );
}

function Pips({ score, large }: { score: number; large?: boolean }) {
  const tone = score >= 4 ? 'bg-good' : score === 3 ? 'bg-ink' : 'bg-warn';
  return (
    <span className="flex gap-1" role="img" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn('rounded-full', large ? 'h-2.5 w-6' : 'h-2 w-4', n <= score ? tone : 'bg-line')}
        />
      ))}
    </span>
  );
}
