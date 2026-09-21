import { randomInt } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { AGENT_UID, getLength, sessionConfigSchema } from '@/lib/interview';
import { describeError, startInterviewAgent } from '@/lib/server/agent';
import { ACCESS_CODE_HEADER, checkAccessCode, getAgoraCredentials } from '@/lib/server/env';

export const dynamic = 'force-dynamic';
// Starting the cloud agent is a network round trip to Agora; leave headroom over the default.
export const maxDuration = 30;

function newChannelName(): string {
  return `cc-${Date.now().toString(36)}-${randomInt(0, 36 ** 6).toString(36)}`;
}

export async function POST(request: NextRequest) {
  if (!checkAccessCode(request.headers.get(ACCESS_CODE_HEADER))) {
    return NextResponse.json({ error: 'That access code is not valid.', code: 'access_code' }, { status: 401 });
  }

  const credentials = getAgoraCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: 'Voice interviews are not configured on this server yet.', code: 'not_configured' },
      { status: 503 },
    );
  }

  const body = sessionConfigSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid interview settings.', code: 'bad_request' }, { status: 400 });
  }
  const config = body.data;

  const channel = newChannelName();
  // Candidate UIDs live far above AGENT_UID so they can never collide with the agent.
  const uid = randomInt(10_000_000, 99_999_999);
  // Token lifetime = the session cap plus a little slack; no renewal flow is needed.
  const capSeconds = getLength(config.length).capMinutes * 60;
  const ttlSeconds = capSeconds + 120;

  try {
    // agora-token takes *relative* seconds here (not an absolute timestamp).
    const token = RtcTokenBuilder.buildTokenWithRtm(
      credentials.appId,
      credentials.appCertificate,
      channel,
      String(uid),
      RtcRole.PUBLISHER,
      ttlSeconds,
      ttlSeconds,
    );

    const { agentId, eosMode } = await startInterviewAgent({
      ...credentials,
      channel,
      userUid: String(uid),
      config,
    });

    return NextResponse.json({
      appId: credentials.appId,
      channel,
      uid: String(uid),
      token,
      agentUid: AGENT_UID,
      agentId,
      capSeconds,
      eosMode,
    });
  } catch (error) {
    // Log the vendor detail server-side; keep the client message generic.
    console.error('Failed to start interview session:', describeError(error));
    return NextResponse.json(
      { error: 'Could not start your interviewer. Please try again in a moment.', code: 'start_failed' },
      { status: 502 },
    );
  }
}
