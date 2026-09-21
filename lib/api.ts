import type { Feedback, TranscriptTurn } from './feedback';
import type { SessionConfig } from './interview';

export interface ServerStatus {
  voiceConfigured: boolean;
  feedbackConfigured: boolean;
  accessCodeRequired: boolean;
}

export interface StartedSession {
  appId: string;
  channel: string;
  uid: string;
  token: string;
  agentUid: string;
  agentId: string;
  capSeconds: number;
}

/** An API failure with a message that's safe to show the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const ACCESS_CODE_HEADER = 'x-access-code';

function headers(accessCode?: string): HeadersInit {
  return {
    'content-type': 'application/json',
    ...(accessCode ? { [ACCESS_CODE_HEADER]: accessCode } : {}),
  };
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      (data && typeof data.error === 'string' && data.error) || 'Something went wrong. Please try again.',
      data?.code,
      res.status,
    );
  }
  return data as T;
}

export async function fetchStatus(): Promise<ServerStatus> {
  return parse<ServerStatus>(await fetch('/api/status', { cache: 'no-store' }));
}

export async function startSession(config: SessionConfig, accessCode?: string): Promise<StartedSession> {
  return parse<StartedSession>(
    await fetch('/api/session/start', {
      method: 'POST',
      headers: headers(accessCode),
      body: JSON.stringify(config),
    }),
  );
}

/** Best-effort: the agent also stops itself on idle timeout, so a failure here is not fatal. */
export async function stopSession(agentId: string): Promise<void> {
  try {
    await fetch('/api/session/stop', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ agentId }),
      // Lets the request finish even if the tab is closing right after.
      keepalive: true,
    });
  } catch (error) {
    console.warn('Could not stop the interviewer cleanly:', error);
  }
}

export async function requestFeedback(
  payload: { config: SessionConfig; transcript: TranscriptTurn[]; durationSeconds: number },
  accessCode?: string,
): Promise<Feedback> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: headers(accessCode),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return (await parse<{ feedback: Feedback }>(res)).feedback;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Feedback took too long. Please try again.', 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
