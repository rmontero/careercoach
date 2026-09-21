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
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
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
      className={cn('overflow-y-auto', className)}
    >
      {turns.length === 0 ? (
        <p className="text-sm text-muted">The conversation will appear here as you talk.</p>
      ) : (
        <ol className="space-y-4">
          {turns.map((turn) => (
            <li key={turn.id} className={cn(turn.speaker === 'candidate' && 'pl-6')}>
              <p className="mb-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
                {turn.speaker === 'interviewer' ? interviewerName : 'You'}
              </p>
              <p className={cn('text-[15px] leading-relaxed', turn.inProgress && 'opacity-70')}>
                {turn.text}
                {turn.inProgress ? <span className="ml-0.5 inline-block animate-pulse">▍</span> : null}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
