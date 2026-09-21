import { NextResponse } from 'next/server';
import { z } from 'zod';
import { describeError, stopInterviewAgent } from '@/lib/server/agent';
import { getAgoraCredentials } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ agentId: z.string().min(1).max(128) });

export async function POST(request: Request) {
  const credentials = getAgoraCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'Not configured.', code: 'not_configured' }, { status: 503 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'agentId is required.', code: 'bad_request' }, { status: 400 });
  }

  try {
    const result = await stopInterviewAgent({ ...credentials, agentId: body.data.agentId });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    // The agent also self-terminates on idle timeout and token expiry, so a failed stop
    // is recoverable; report it without alarming the user.
    console.error('Failed to stop agent:', describeError(error));
    return NextResponse.json({ error: 'Could not stop the interviewer.', code: 'stop_failed' }, { status: 502 });
  }
}
