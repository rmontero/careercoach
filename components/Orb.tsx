import { cn } from '@/lib/cn';

export type OrbState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'muted' | 'ended';

interface OrbProps {
  state: OrbState;
  /** CSS length for the orb's diameter. */
  size?: string;
  className?: string;
}

/**
 * The interviewer's presence: it glows and pulses when speaking, spins while thinking, rests
 * while listening. It also swells with the candidate's voice via the inherited `--level` CSS
 * variable. Everything animates with transform/opacity only.
 */
export function Orb({ state, size = '220px', className }: OrbProps) {
  return (
    <div
      className={cn('orb', className)}
      data-state={state}
      style={{ '--orb-size': size } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="orb__glow" />
      <span className="orb__ring orb__ring--a" />
      <span className="orb__ring orb__ring--b" />
      <span className="orb__ring orb__ring--c" />
      <span className="orb__arc" />
      <span className="orb__core" />
    </div>
  );
}
