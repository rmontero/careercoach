'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { Turn } from '@/lib/transcript';

interface TranscriptPanelProps {
  turns: Turn[];
  interviewerName: string;
  className?: string;
}

export function TranscriptPanel({ turns, interviewerName, className }: TranscriptPanelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Keep the newest line in view, unless the candidate scrolled up to re-read something.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      role="log"
      aria-label="Live transcript"
      aria-relevant="additions"
      className={cn('overflow-y-auto overscroll-contain', className)}
    >
      {turns.length === 0 ? (
        <p className="text-sm text-muted">The conversation will appear here as you talk.</p>
      ) : (
        <ol className="space-y-3">
          {turns.map((turn) => {
            const mine = turn.speaker === 'candidate';
            return (
              <li key={turn.id} className={cn('flex flex-col', mine ? 'items-end pl-8' : 'items-start pr-8')}>
                <p className="mb-1 px-1 font-mono text-xs uppercase tracking-wider text-muted">
                  {mine ? 'You' : interviewerName}
                </p>
                <p
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed transition-opacity',
                    mine ? 'rounded-tr-md bg-accent-soft' : 'rounded-tl-md border border-line bg-surface/70',
                    turn.inProgress && 'opacity-75',
                  )}
                >
                  {turn.text}
                  {turn.inProgress ? <span className="ml-0.5 inline-block motion-safe:animate-pulse">▍</span> : null}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
