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
  getType,
  type SessionConfig,
} from '@/lib/interview';
import {
  AlertIcon,
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  TYPE_ICONS,
  TargetIcon,
  WaveIcon,
} from './icons';

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

const HIGHLIGHTS = [
  { icon: WaveIcon, label: 'Talk, don’t type' },
  { icon: TargetIcon, label: 'Calibrated to your level' },
  { icon: ChartIcon, label: 'Scorecard with evidence' },
];

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
  const selectedType = getType(config.type);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-16 lg:pt-12">
      <section className="lg:sticky lg:top-12 lg:self-start">
        <p className="chip rise" style={{ '--i': 0 } as React.CSSProperties}>
          <span aria-hidden className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
          Voice mock interviews
        </p>
        <h1
          className="rise mt-4 font-serif text-[2.75rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          Practice the interview <em className="grad-text pr-1 italic">before it counts.</em>
        </h1>
        <p
          className="rise mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          Talk to a live interviewer that listens, pushes back, and asks the follow-up you were hoping to avoid. Then
          get a scorecard grounded in what you actually said.
        </p>
        {/* Hidden on phones: the paragraph above already says this, and the form should come first. */}
        <ul
          className="rise mt-5 hidden flex-wrap gap-2 sm:flex lg:mt-8 lg:flex-col lg:items-start"
          style={{ '--i': 3 } as React.CSSProperties}
        >
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="glass flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium"
            >
              <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent-text">
                <Icon className="size-3.5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <form
        className="glass rise mt-7 rounded-[28px] p-4 sm:p-7 lg:mt-0"
        style={{ '--i': 3 } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onStart();
        }}
      >
        <fieldset>
          <legend className="mb-3 text-sm font-medium">What are we practicing?</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {INTERVIEW_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t.id];
              return (
                <label key={t.id} className="block">
                  <input
                    type="radio"
                    name="type"
                    value={t.id}
                    checked={config.type === t.id}
                    onChange={() => set('type', t.id)}
                    className="sr-only"
                  />
                  <span className="choice relative flex h-full min-h-[92px] cursor-pointer flex-col gap-2 rounded-2xl p-3.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-text">
                      <Icon />
                    </span>
                    <span className="text-[15px] font-medium leading-tight">{t.label}</span>
                    <span className="hidden text-[13px] leading-snug text-muted sm:block">{t.blurb}</span>
                    <span className="choice__check pop absolute right-2.5 top-2.5 size-5 place-items-center rounded-full bg-ink text-on-ink">
                      <CheckIcon className="size-3" />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {/* On phones the cards are label-only to keep the form short; the description follows the choice. */}
          <p aria-live="polite" className="mt-3 min-h-10 text-sm leading-snug text-muted sm:hidden">
            {selectedType.blurb}
          </p>
        </fieldset>

        <div className="mt-6 grid gap-6 sm:mt-7 sm:grid-cols-2">
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

        <div className="mt-6 sm:mt-7">
          <label htmlFor="context" className="mb-2 flex items-baseline justify-between gap-3 text-sm font-medium">
            <span>
              Anything {INTERVIEWER_NAME} should know? <span className="font-normal text-muted">Optional</span>
            </span>
            <span className="font-mono text-xs font-normal text-muted">
              {(config.context ?? '').length}/{MAX_CONTEXT_CHARS}
            </span>
          </label>
          <textarea
            id="context"
            rows={2}
            maxLength={MAX_CONTEXT_CHARS}
            value={config.context ?? ''}
            onChange={(e) => set('context', e.target.value)}
            placeholder="e.g. Senior backend role at a fintech. Go, Kafka, Postgres."
            className="w-full resize-none rounded-2xl border border-line bg-paper/50 px-4 py-3 text-base placeholder:text-muted/80 transition focus:border-ink focus:outline-none"
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
              className="min-h-12 w-full rounded-2xl border border-line bg-paper/50 px-4 text-base transition focus:border-ink focus:outline-none"
              aria-invalid={touchedCode && codeMissing}
              aria-describedby={touchedCode && codeMissing ? 'code-hint' : undefined}
            />
            {touchedCode && codeMissing && (
              <p id="code-hint" className="mt-2 text-[13px] text-accent-text">
                Enter your access code to start.
              </p>
            )}
          </div>
        )}

        {voiceDown && (
          <Notice tone="warn">
            Voice interviews aren’t configured on this server yet. Add <code className="font-mono">AGORA_APP_ID</code>{' '}
            and <code className="font-mono">AGORA_APP_CERTIFICATE</code>, then redeploy.
          </Notice>
        )}
        {status && status.voiceConfigured && !status.feedbackConfigured && (
          <Notice tone="info">
            Written feedback is off (no <code className="font-mono">ANTHROPIC_API_KEY</code>). You can still practice and
            download your transcript.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Your browser will ask for microphone access, and headphones work best. We don’t record or store audio or
          transcripts. Speech is processed live by Agora and its speech providers, and your transcript is sent to Claude
          to write your feedback.
        </p>

        {/* Sticky on phones so the primary action is always in reach; inline from `sm` up. */}
        <div className="sticky-cta sticky bottom-0 -mx-4 mt-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mt-4 sm:bg-none sm:p-0 sm:backdrop-blur-none">
          <button type="submit" disabled={disabled} className="btn btn-primary w-full min-h-[3.25rem]">
            {starting ? (
              <>
                <Spinner /> Connecting to {INTERVIEWER_NAME}…
              </>
            ) : (
              <>
                Start interview <ArrowRightIcon className="size-4" />
              </>
            )}
          </button>
        </div>
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

/** Radio group styled as a segmented control with a thumb that slides between options. */
function Segmented<T extends string>({ legend, name, value, onChange, options }: SegmentedProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div className="seg" style={{ '--n': options.length, '--i': index } as React.CSSProperties}>
        <span className="seg__thumb" aria-hidden />
        {options.map((o) => (
          <label key={o.value} className="relative z-10 min-w-0">
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
                'grid min-h-11 cursor-pointer place-items-center truncate rounded-full px-2 text-[13px] font-medium transition-colors duration-200',
                'text-muted peer-checked:text-on-ink',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-3',
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
        'mt-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'info' && 'border border-line bg-paper/50 text-muted',
        tone === 'error' && 'bg-accent-soft text-accent-text',
      )}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none"
    />
  );
}
