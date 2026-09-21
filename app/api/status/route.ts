import { NextResponse } from 'next/server';
import { getAgoraCredentials, isAccessCodeRequired, isFeedbackConfigured } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

/** Lets the UI show what's missing instead of failing after the user grants mic access. */
export function GET() {
  return NextResponse.json({
    voiceConfigured: getAgoraCredentials() !== null,
    feedbackConfigured: isFeedbackConfigured(),
    accessCodeRequired: isAccessCodeRequired(),
  });
}
