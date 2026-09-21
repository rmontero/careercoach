import { z } from 'zod';

/**
 * Client-safe catalog of what a candidate can practice. Anything that shapes the
 * interviewer's behaviour (prompts, question banks) lives in `interviewer.ts`, which is
 * server-only so the prompt never ships to the browser.
 */

export const INTERVIEW_TYPES = [
  {
    id: 'behavioral',
    label: 'Behavioral',
    blurb: 'Ownership, conflict, failure, impact. Tell stories that land.',
  },
  {
    id: 'system-design',
    label: 'System design',
    blurb: 'Scope it, sketch it, then defend the trade-offs at scale.',
  },
  {
    id: 'coding',
    label: 'Coding & algorithms',
    blurb: 'Talk through the problem, approach, complexity, and edge cases.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    blurb: 'Browser fundamentals, state, performance, accessibility.',
  },
  {
    id: 'backend',
    label: 'Backend & data',
    blurb: 'APIs, databases, consistency, and keeping services up.',
  },
  {
    id: 'leadership',
    label: 'Eng leadership',
    blurb: 'Influence without authority, mentoring, prioritization.',
  },
] as const;

export const LEVELS = [
  { id: 'junior', label: 'Junior', blurb: '0–2 yrs' },
  { id: 'mid', label: 'Mid', blurb: '2–5 yrs' },
  { id: 'senior', label: 'Senior', blurb: '5–8 yrs' },
  { id: 'staff', label: 'Staff+', blurb: '8+ yrs' },
] as const;

/**
 * `minutes` is the target the interviewer paces to. `capMinutes` is the hard ceiling:
 * the agent's own RTC token expires then, and the browser auto-ends the call. That makes
 * cost per session bounded even if a client misbehaves.
 */
export const LENGTHS = [
  { id: 'quick', label: 'Quick', minutes: 10, capMinutes: 15 },
  { id: 'standard', label: 'Standard', minutes: 20, capMinutes: 28 },
  { id: 'deep', label: 'Deep dive', minutes: 30, capMinutes: 40 },
] as const;

export type InterviewTypeId = (typeof INTERVIEW_TYPES)[number]['id'];
export type LevelId = (typeof LEVELS)[number]['id'];
export type LengthId = (typeof LENGTHS)[number]['id'];

const typeIds = INTERVIEW_TYPES.map((t) => t.id) as [InterviewTypeId, ...InterviewTypeId[]];
const levelIds = LEVELS.map((l) => l.id) as [LevelId, ...LevelId[]];
const lengthIds = LENGTHS.map((l) => l.id) as [LengthId, ...LengthId[]];

export const MAX_CONTEXT_CHARS = 600;

export const sessionConfigSchema = z.object({
  type: z.enum(typeIds),
  level: z.enum(levelIds),
  length: z.enum(lengthIds),
  /** Optional free text from the candidate: target role, company, stack, focus areas. */
  context: z.string().trim().max(MAX_CONTEXT_CHARS).optional(),
});

export type SessionConfig = z.infer<typeof sessionConfigSchema>;

export const DEFAULT_CONFIG: SessionConfig = {
  type: 'behavioral',
  level: 'senior',
  length: 'standard',
};

export function getType(id: InterviewTypeId) {
  return INTERVIEW_TYPES.find((t) => t.id === id)!;
}
export function getLevel(id: LevelId) {
  return LEVELS.find((l) => l.id === id)!;
}
export function getLength(id: LengthId) {
  return LENGTHS.find((l) => l.id === id)!;
}

/** The interviewer says this exact phrase when the interview is over; the UI listens for it. */
export const CLOSING_PHRASE = 'That wraps up our mock interview.';
export const CLOSING_MATCHER = /wraps up our mock interview/i;

/** UID the cloud agent uses inside the channel. Users get random UIDs far above this. */
export const AGENT_UID = '1';

/** Name of the interviewer persona. Gender-neutral on purpose; the voice is configured separately. */
export const INTERVIEWER_NAME = 'Sam';
