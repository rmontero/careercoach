import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Server-side configuration. Accepts both our own names and the ones the official Agora
 * quickstart (and `agora init`) writes, so credentials from either drop in unchanged.
 */
export function getAgoraCredentials(): { appId: string; appCertificate: string } | null {
  const appId = process.env.AGORA_APP_ID ?? process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate =
    process.env.AGORA_APP_CERTIFICATE ?? process.env.NEXT_AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate) return null;
  return { appId, appCertificate };
}

export function isFeedbackConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Optional gate for a public deployment. Every session start spends real money
 * (Agora minutes + LLM/TTS/ASR), so if COACH_ACCESS_CODE is set, callers must supply it.
 */
export function isAccessCodeRequired(): boolean {
  return Boolean(process.env.COACH_ACCESS_CODE);
}

export function checkAccessCode(provided: string | null | undefined): boolean {
  const expected = process.env.COACH_ACCESS_CODE;
  if (!expected) return true;
  if (!provided) return false;
  // Hash both sides so timingSafeEqual gets equal-length buffers and length doesn't leak.
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export const ACCESS_CODE_HEADER = 'x-access-code';
