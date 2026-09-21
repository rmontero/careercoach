import { NextResponse, type NextRequest } from 'next/server';
import {
  feedbackRequestSchema,
  MAX_TRANSCRIPT_CHARS,
  MIN_CANDIDATE_WORDS,
  countCandidateWords,
} from '@/lib/feedback';
import { ACCESS_CODE_HEADER, checkAccessCode, isFeedbackConfigured } from '@/lib/server/env';
import { FeedbackError, generateFeedback } from '@/lib/server/feedback';

export const dynamic = 'force-dynamic';
// Structured feedback from a long transcript can take a while; 60s fits every Vercel plan.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!checkAccessCode(request.headers.get(ACCESS_CODE_HEADER))) {
    return NextResponse.json({ error: 'That access code is not valid.', code: 'access_code' }, { status: 401 });
  }
  if (!isFeedbackConfigured()) {
    return NextResponse.json(
      { error: 'Written feedback is not configured on this server.', code: 'not_configured' },
      { status: 503 },
    );
  }

  const parsed = feedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid feedback request.', code: 'bad_request' }, { status: 400 });
  }
  const req = parsed.data;

  const totalChars = req.transcript.reduce((n, t) => n + t.text.length, 0);
  if (totalChars > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: 'That transcript is too long to review.', code: 'too_long' }, { status: 413 });
  }
  // Don't pay for a model call when there's nothing to assess.
  if (countCandidateWords(req.transcript) < MIN_CANDIDATE_WORDS) {
    return NextResponse.json(
      {
        error: 'There was not enough conversation to give useful feedback. Try a longer session.',
        code: 'not_enough_conversation',
      },
      { status: 422 },
    );
  }

  try {
    const feedback = await generateFeedback(req);
    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json({ error: error.message, code: 'feedback_failed' }, { status: error.status });
    }
    console.error('Unexpected feedback error:', error);
    return NextResponse.json({ error: 'Could not generate feedback.', code: 'feedback_failed' }, { status: 500 });
  }
}
