'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { ServerStatus } from '@/lib/api';
import {
  INTERVIEWER_NAME,
  INTERVIEW_TYPES,
  LENGTHS,
  LEVELS,
  MAX_CONTEXT_CHARS,
  type SessionConfig,
} from '@/lib/interview';

interface SetupScreenProps {
  status: ServerStatus | null;
  config: SessionConfig;
  onConfigChange: (config: SessionConfig) => void;
  accessCode: string;
  onAccessCodeChange: (code: string) => void;
  starting: boolean;
  error: string | null;
  onStart: () => void;
}

export function SetupScreen({
  status,
  config,
  onConfigChange,
  accessCode,
  onAccessCodeChange,
  starting,
  error,
  onStart,
}: SetupScreenProps) {
  const [touchedCode, setTouchedCode] = useState(false);
  const set = <K extends keyof SessionConfig>(key: K, value: SessionConfig[K]) =>
    onConfigChange({ ...config, [key]: value });

  const voiceDown = status !== null && !status.voiceConfigured;
  const needsCode = status?.accessCodeRequired ?? false;
  const codeMissing = needsCode && accessCode.trim() === '';
  const disabled = starting || voiceDown || codeMissing;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)] lg:gap-16 lg:pt-16">
      <section className="rise lg:pt-6">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-accent">Voice mock interviews</p>
        <h1 className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
          Practice the interview <em className="italic">before it counts.</em>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          Talk to a live interviewer that listens, pushes back, and asks the follow-up you were hoping to avoid. When you
          finish, you get a scorecard grounded in what you actually said.
        </p>
        <ul className="mt-8 space-y-3 text-[15px]">
          {[
            ['Speak, don’t type.', 'Real-time voice with natural interruptions.'],
            ['Calibrated to your level.', 'Junior through Staff+, six interview types.'],
            ['Feedback you can act on.', 'Scores, evidence from your answers, and what to try instead.'],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium">{title}</strong> <span className="text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form
        className="rise rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_0_var(--line),0_24px_60px_-40px_rgba(0,0,0,0.35)] sm:p-8"
        style={{ animationDelay: '80ms' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onStart();
        }}
      >
        <fieldset>
          <legend className="mb-3 text-sm font-medium">What are we practicing?</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {INTERVIEW_TYPES.map((t) => (
              <label key={t.id} className="block">
                <input
                  type="radio"
                  name="type"
                  value={t.id}
                  checked={config.type === t.id}
                  onChange={() => set('type', t.id)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    'block h-full cursor-pointer rounded-2xl border border-line px-4 py-3 transition',
                    'hover:border-line-strong peer-checked:border-ink peer-checked:bg-paper',
                    'peer-checked:shadow-[inset_0_0_0_1px_var(--ink)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                  )}
                >
                  <span className="block text-[15px] font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{t.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-7 grid gap-7 sm:grid-cols-2">
          <Segmented
            legend="Level"
            name="level"
            value={config.level}
            onChange={(v) => set('level', v)}
            options={LEVELS.map((l) => ({ value: l.id, label: l.label, hint: l.blurb }))}
          />
          <Segmented
            legend="Length"
            name="length"
            value={config.length}
            onChange={(v) => set('length', v)}
            options={LENGTHS.map((l) => ({ value: l.id, label: l.label, hint: `~${l.minutes} min` }))}
          />
        </div>

        <div className="mt-7">
          <label htmlFor="context" className="mb-2 flex items-baseline justify-between text-sm font-medium">
            <span>
              Anything {INTERVIEWER_NAME} should know? <span className="font-normal text-muted">Optional</span>
            </span>
            <span className="font-mono text-[11px] font-normal text-muted">
              {(config.context ?? '').length}/{MAX_CONTEXT_CHARS}
            </span>
          </label>
          <textarea
            id="context"
            rows={2}
            maxLength={MAX_CONTEXT_CHARS}
            value={config.context ?? ''}
            onChange={(e) => set('context', e.target.value)}
            placeholder="e.g. Senior backend role at a fintech. Go, Kafka, Postgres. Weak on system design."
            className="w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] placeholder:text-muted/70 focus:border-ink focus:outline-none"
          />
        </div>

        {needsCode && (
          <div className="mt-5">
            <label htmlFor="code" className="mb-2 block text-sm font-medium">
              Access code
            </label>
            <input
              id="code"
              type="password"
              autoComplete="off"
              value={accessCode}
              onChange={(e) => onAccessCodeChange(e.target.value)}
              onBlur={() => setTouchedCode(true)}
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] focus:border-ink focus:outline-none"
              aria-invalid={touchedCode && codeMissing}
            />
          </div>
        )}

        {voiceDown && (
          <Notice tone="warn">
            Voice interviews aren’t configured on this server yet. Add <code className="font-mono">AGORA_APP_ID</code> and{' '}
            <code className="font-mono">AGORA_APP_CERTIFICATE</code>, then redeploy.
          </Notice>
        )}
        {status && status.voiceConfigured && !status.feedbackConfigured && (
          <Notice tone="info">
            Written feedback is off (no <code className="font-mono">ANTHROPIC_API_KEY</code>). You can still practice and
            download your transcript.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        <button
          type="submit"
          disabled={disabled}
          className={cn(
            'mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 text-[15px] font-medium text-on-ink transition',
            'hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {starting ? (
            <>
              <Spinner /> Connecting to {INTERVIEWER_NAME}…
            </>
          ) : (
            <>Start interview</>
          )}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          Your browser will ask for microphone access, and headphones work best. We don’t record or store audio or
          transcripts. Speech is processed live by Agora and its speech providers, and your transcript is sent to Claude
          to write your feedback.
        </p>
      </form>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint: string }[];
}

function Segmented<T extends string>({ legend, name, value, onChange, options }: SegmentedProps<T>) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div className="flex rounded-full border border-line bg-paper p-1">
        {options.map((o) => (
          <label key={o.value} className="min-w-0 flex-1">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              title={o.hint}
              className={cn(
                'block cursor-pointer truncate rounded-full px-2 py-2 text-center text-[13px] transition',
                'text-muted hover:text-ink peer-checked:bg-ink peer-checked:text-on-ink',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{options.find((o) => o.value === value)?.hint}</p>
    </fieldset>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'info' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'mt-5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'info' && 'bg-paper text-muted',
        tone === 'error' && 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </p>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-on-ink/30 border-t-on-ink motion-reduce:animate-none"
    />
  );
}
