import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MIN_CANDIDATE_WORDS,
  countCandidateWords,
  feedbackRequestSchema,
  normalizeFeedback,
  type Feedback,
} from './feedback';
import { reportToMarkdown } from './report';
import { buildFeedbackUserMessage, RUBRIC } from './server/feedback';
import { INTERVIEW_TYPES } from './interview';

const sample: Feedback = {
  summary: 'You structured your answers well.',
  readiness: 'getting_there',
  overall_score: 3.6,
  dimensions: [
    { name: 'Structure & clarity', score: 9, evidence: 'You said "first, the situation".', advice: 'Lead with the result.' },
    { name: 'Communication', score: -2, evidence: 'Long pauses.', advice: 'Signpost.' },
  ],
  strengths: ['Clear ownership'],
  improvements: [{ issue: 'No metrics', why_it_matters: 'Impact is unclear.', try_instead: 'Say [the metric].' }],
  practice_plan: ['Rehearse two stories'],
};

describe('normalizeFeedback', () => {
  it('rounds and clamps scores into 1..5', () => {
    const n = normalizeFeedback(sample);
    assert.equal(n.overall_score, 4);
    assert.deepEqual(
      n.dimensions.map((d) => d.score),
      [5, 1],
    );
  });

  it('treats non-finite scores as the minimum', () => {
    const n = normalizeFeedback({ ...sample, overall_score: Number.NaN });
    assert.equal(n.overall_score, 1);
  });
});

describe('countCandidateWords', () => {
  it('counts only the candidate’s words', () => {
    const words = countCandidateWords([
      { speaker: 'interviewer', text: 'one two three four five' },
      { speaker: 'candidate', text: '  hello   there world ' },
      { speaker: 'candidate', text: '' },
    ]);
    assert.equal(words, 3);
  });

  it('exposes a sane minimum', () => {
    assert.ok(MIN_CANDIDATE_WORDS >= 20);
  });
});

describe('feedbackRequestSchema', () => {
  const ok = {
    config: { type: 'behavioral', level: 'mid', length: 'quick' },
    transcript: [{ speaker: 'candidate', text: 'hi' }],
  };
  it('accepts a valid request', () => {
    assert.ok(feedbackRequestSchema.safeParse(ok).success);
  });
  it('rejects unknown speakers and interview types', () => {
    assert.ok(!feedbackRequestSchema.safeParse({ ...ok, transcript: [{ speaker: 'system', text: 'x' }] }).success);
    assert.ok(!feedbackRequestSchema.safeParse({ ...ok, config: { ...ok.config, type: 'astrology' } }).success);
  });
  it('rejects oversized transcripts and notes', () => {
    const many = Array.from({ length: 401 }, () => ({ speaker: 'candidate', text: 'x' }));
    assert.ok(!feedbackRequestSchema.safeParse({ ...ok, transcript: many }).success);
    assert.ok(!feedbackRequestSchema.safeParse({ ...ok, config: { ...ok.config, context: 'x'.repeat(601) } }).success);
  });
});

describe('buildFeedbackUserMessage', () => {
  const req = feedbackRequestSchema.parse({
    config: { type: 'coding', level: 'senior', length: 'standard', context: 'Go <b>dev</b>' },
    transcript: [
      { speaker: 'interviewer', text: 'Merge intervals.' },
      { speaker: 'candidate', text: 'I would sort first.' },
    ],
    durationSeconds: 1140,
  });

  it('includes the rubric, duration, and a labelled transcript', () => {
    const m = buildFeedbackUserMessage(req);
    for (const d of RUBRIC.coding) assert.ok(m.includes(d), d);
    assert.match(m, /about 19 minutes/);
    assert.match(m, /INTERVIEWER: Merge intervals\./);
    assert.match(m, /CANDIDATE: I would sort first\./);
    assert.match(m, /<transcript>[\s\S]*<\/transcript>/);
  });

  it('strips angle brackets from the candidate’s notes', () => {
    assert.ok(!buildFeedbackUserMessage(req).includes('<b>'));
  });

  it('defines a rubric for every interview type', () => {
    for (const t of INTERVIEW_TYPES) assert.ok(RUBRIC[t.id].length >= 4, t.id);
  });
});

describe('reportToMarkdown', () => {
  it('renders scores, plan and transcript', () => {
    const md = reportToMarkdown(
      normalizeFeedback(sample),
      { type: 'behavioral', level: 'mid', length: 'quick' },
      [{ speaker: 'candidate', text: 'hello' }],
      600,
    );
    assert.match(md, /# Interview feedback: Behavioral \(Mid\)/);
    assert.match(md, /Getting there · 4\/5 · 10 min/);
    assert.match(md, /- \[ \] Rehearse two stories/);
    assert.match(md, /You: hello/);
  });
});
