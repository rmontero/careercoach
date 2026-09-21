import { z } from 'zod';
import { sessionConfigSchema } from './interview';

/**
 * Shared (client + server) shapes for the post-interview scorecard.
 *
 * Numeric ranges are described in prose rather than with min/max because structured-output
 * schemas don't enforce them; `normalizeFeedback` clamps after parsing instead.
 */

export const READINESS_LEVELS = ['not_yet', 'getting_there', 'interview_ready', 'standout'] as const;
export type Readiness = (typeof READINESS_LEVELS)[number];

export const READINESS_LABEL: Record<Readiness, string> = {
  not_yet: 'Not yet',
  getting_there: 'Getting there',
  interview_ready: 'Interview ready',
  standout: 'Standout',
};

export const feedbackSchema = z.object({
  summary: z
    .string()
    .describe('Two to three sentences addressed to the candidate as "you": the overall read of how it went.'),
  readiness: z
    .enum(READINESS_LEVELS)
    .describe('How ready this performance is for a real interview at the stated level.'),
  overall_score: z.number().describe('Integer from 1 to 5, consistent with the dimension scores.'),
  dimensions: z
    .array(
      z.object({
        name: z.string().describe('Exactly one of the rubric dimension names provided.'),
        score: z.number().describe('Integer from 1 to 5.'),
        evidence: z
          .string()
          .describe('What the candidate actually said that justifies the score. Quote or closely paraphrase.'),
        advice: z.string().describe('One concrete, actionable tip for this dimension.'),
      }),
    )
    .describe('One entry per rubric dimension, in the order given.'),
  strengths: z.array(z.string()).describe('Two to four specific things the candidate did well.'),
  improvements: z
    .array(
      z.object({
        issue: z.string().describe('The specific weakness, tied to something in the transcript.'),
        why_it_matters: z.string().describe('Why an interviewer at this level would care.'),
        try_instead: z
          .string()
          .describe(
            'A concrete structure or rewording to try next time. Use placeholders like [the metric] for facts only the candidate knows; never invent their experience.',
          ),
      }),
    )
    .describe('Two to four highest-leverage improvements, most important first.'),
  practice_plan: z.array(z.string()).describe('Two to four specific things to practice before the next session.'),
});

export type Feedback = z.infer<typeof feedbackSchema>;

export const transcriptTurnSchema = z.object({
  speaker: z.enum(['interviewer', 'candidate']),
  text: z.string().max(4000),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

export const feedbackRequestSchema = z.object({
  config: sessionConfigSchema,
  transcript: z.array(transcriptTurnSchema).max(400),
  durationSeconds: z.number().nonnegative().max(60 * 60).optional(),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

/** Below this many spoken candidate words there isn't enough signal to assess anything. */
export const MIN_CANDIDATE_WORDS = 40;
export const MAX_TRANSCRIPT_CHARS = 60_000;

export function countCandidateWords(transcript: TranscriptTurn[]): number {
  return transcript
    .filter((t) => t.speaker === 'candidate')
    .reduce((sum, t) => sum + (t.text.trim() ? t.text.trim().split(/\s+/).length : 0), 0);
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Enforce the ranges the schema can only describe. */
export function normalizeFeedback(raw: Feedback): Feedback {
  return {
    ...raw,
    overall_score: clampScore(raw.overall_score),
    dimensions: raw.dimensions.map((d) => ({ ...d, score: clampScore(d.score) })),
  };
}
