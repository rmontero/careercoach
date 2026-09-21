import {
  Agent,
  AgoraClient,
  Area,
  DeepgramSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from 'agora-agents';
import { AGENT_UID, getLength, type SessionConfig } from '../interview';
import { buildGreeting, buildInterviewerPrompt, pickSeedQuestion } from '../interviewer';

/** Managed (keyless) OpenAI models Agora resells. GPT-5 variants reason too long for voice. */
const MANAGED_LLM_MODELS = ['gpt-4.1-mini', 'gpt-4o-mini'] as const;
type ManagedLlmModel = (typeof MANAGED_LLM_MODELS)[number];

const FAILURE_MESSAGE = 'Sorry, I lost that for a second. Could you say that again?';

export type EndOfSpeechMode = 'semantic' | 'vad';

function resolveLlmModel(): ManagedLlmModel {
  const requested = process.env.COACH_LLM_MODEL;
  return MANAGED_LLM_MODELS.find((m) => m === requested) ?? 'gpt-4.1-mini';
}

/**
 * How the agent decides the candidate has finished talking.
 *
 * Interview answers include long pauses mid-thought, so the default is semantic detection
 * with pause intent ("give me a second") instead of a fixed silence timer that would talk
 * over people who are thinking. VAD is the fallback if the project can't use semantic mode.
 */
function turnDetection(mode: EndOfSpeechMode) {
  return {
    config: {
      speech_threshold: 0.5,
      start_of_speech: {
        mode: 'vad' as const,
        vad_config: {
          // Long enough that "mm-hm" or a cough doesn't cut off the interviewer.
          interrupt_duration_ms: 240,
          prefix_padding_ms: 300,
        },
      },
      end_of_speech:
        mode === 'semantic'
          ? {
              mode: 'semantic' as const,
              semantic_config: {
                silence_duration_ms: 900,
                max_wait_ms: 4000,
                pause_state_enabled: true,
              },
            }
          : {
              mode: 'vad' as const,
              vad_config: { silence_duration_ms: 1200 },
            },
    },
  };
}

export function buildAgent(
  client: AgoraClient<typeof Area.US>,
  config: SessionConfig,
  eosMode: EndOfSpeechMode = 'semantic',
) {
  const seedQuestion = pickSeedQuestion(config.type, config.level);

  return new Agent({
    client,
    turnDetection: turnDetection(eosMode),
    // RTM carries transcripts, agent state and errors to the browser.
    advancedFeatures: { enable_rtm: true },
    parameters: {
      audio_scenario: 'chorus', // web client → low-latency profile
      data_channel: 'rtm',
      enable_error_message: true,
    },
  })
    // Managed credentials: with no vendor API keys the SDK selects Agora-billed presets.
    .withStt(new DeepgramSTT({ model: 'nova-3', language: 'en' }))
    .withLlm(
      new OpenAI({
        model: resolveLlmModel(),
        systemMessages: [
          { role: 'system', content: buildInterviewerPrompt(config, seedQuestion) },
        ],
        greetingMessage: buildGreeting(config),
        failureMessage: FAILURE_MESSAGE,
        // ~40 messages covers a full 30 minute session without unbounded prompt growth.
        maxHistory: 40,
        // Spoken turns are short; the cap also keeps a runaway generation from costing much.
        maxTokens: 400,
        temperature: 0.7,
        topP: 0.95,
      }),
    )
    .withTts(
      new MiniMaxTTS({
        model: 'speech_2_6_turbo',
        voiceId: process.env.COACH_TTS_VOICE_ID || 'English_captivating_female1',
      }),
    );
}

export interface StartedAgent {
  agentId: string;
  eosMode: EndOfSpeechMode;
}

/**
 * Starts the cloud agent in `channel`. Tries semantic turn detection first and retries once
 * with VAD if Agora rejects the request as invalid (e.g. the feature isn't enabled).
 */
export async function startInterviewAgent(opts: {
  appId: string;
  appCertificate: string;
  channel: string;
  userUid: string;
  config: SessionConfig;
}): Promise<StartedAgent> {
  const client = new AgoraClient({
    area: Area.US,
    appId: opts.appId,
    appCertificate: opts.appCertificate,
  });
  const capMinutes = getLength(opts.config.length).capMinutes;

  const start = async (eosMode: EndOfSpeechMode) => {
    const agent = buildAgent(client, opts.config, eosMode);
    const session = agent.createSession({
      name: `cc-${opts.channel}`,
      channel: opts.channel,
      agentUid: AGENT_UID,
      // Only listen to this candidate, never other participants who might join.
      remoteUids: [opts.userUid],
      // Best-effort: lets Agora stop an agent whose candidate has gone away.
      idleTimeout: 60,
      // The deterministic guard: the agent's own token lapses at the cap, hard-bounding the
      // session length even if the browser never calls /api/session/stop.
      expiresIn: ExpiresIn.minutes(capMinutes),
      debug: false,
    });
    return { agentId: await session.start(), eosMode };
  };

  try {
    return await start('semantic');
  } catch (error) {
    if (!isBadRequest(error)) throw error;
    console.warn('Semantic turn detection rejected; retrying with VAD.', describeError(error));
    return start('vad');
  }
}

export async function stopInterviewAgent(opts: {
  appId: string;
  appCertificate: string;
  agentId: string;
}): Promise<'stopped' | 'already-stopped'> {
  const client = new AgoraClient({
    area: Area.US,
    appId: opts.appId,
    appCertificate: opts.appCertificate,
  });
  try {
    await client.stopAgent(opts.agentId);
    return 'stopped';
  } catch (error) {
    if (isAlreadyStopped(error)) return 'already-stopped';
    throw error;
  }
}

interface ApiErrorLike {
  statusCode?: number;
  body?: { detail?: string; reason?: string };
  message?: string;
}

function asApiError(error: unknown): ApiErrorLike {
  return error && typeof error === 'object' ? (error as ApiErrorLike) : {};
}

function isBadRequest(error: unknown): boolean {
  return asApiError(error).statusCode === 400;
}

/** Stop is idempotent: a missing agent, or one already shutting down, counts as stopped. */
export function isAlreadyStopped(error: unknown): boolean {
  const e = asApiError(error);
  if (e.statusCode === 404) return true;
  const detail = (e.body?.detail ?? e.message ?? '').toLowerCase();
  return (
    e.body?.reason?.toLowerCase() === 'invalidrequest' &&
    detail.includes('already in the process of shutting down')
  );
}

export function describeError(error: unknown): string {
  const e = asApiError(error);
  const parts = [
    e.statusCode ? `status ${e.statusCode}` : null,
    e.body?.reason,
    e.body?.detail ?? e.message,
  ].filter(Boolean);
  return parts.join(' · ') || 'unknown error';
}
