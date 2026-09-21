import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { AgoraClient, Area, ExpiresIn } from 'agora-agents';
import { AGENT_UID, type SessionConfig } from '../interview';
import { buildAgent, isAlreadyStopped } from './agent';
import { checkAccessCode, getAgoraCredentials } from './env';

const APP_ID = 'a'.repeat(32);
const CERT = 'b'.repeat(32);
const config: SessionConfig = { type: 'behavioral', level: 'mid', length: 'quick', context: 'Platform team, Kubernetes' };

function propertiesFor(mode: 'semantic' | 'vad') {
  const client = new AgoraClient({ area: Area.US, appId: APP_ID, appCertificate: CERT });
  return buildAgent(client, config, mode).toProperties({
    channel: 'cc-test',
    agentUid: AGENT_UID,
    remoteUids: ['12345678'],
    idleTimeout: 60,
    appId: APP_ID,
    appCertificate: CERT,
    expiresIn: ExpiresIn.minutes(15),
  });
}

describe('agent payload', () => {
  it('locks the agent to the candidate and enables idle exit', () => {
    const p = propertiesFor('semantic');
    assert.equal(p.channel, 'cc-test');
    assert.equal(p.agent_rtc_uid, AGENT_UID);
    assert.deepEqual(p.remote_rtc_uids, ['12345678']);
    assert.equal(p.idle_timeout, 60);
    assert.ok(p.token && p.token.length > 50, 'agent token is generated');
  });

  it('delivers transcripts over RTM', () => {
    const p = propertiesFor('semantic');
    assert.equal(p.advanced_features?.enable_rtm, true);
    assert.equal(p.parameters?.data_channel, 'rtm');
  });

  it('puts the interviewer prompt and greeting on the LLM', () => {
    const llm = propertiesFor('semantic').llm!;
    const system = (llm.system_messages as { role: string; content: string }[])[0];
    assert.equal(system.role, 'system');
    assert.match(system.content, /mock interview/);
    assert.match(system.content, /Kubernetes/);
    assert.match(llm.greeting_message!, /about 10 minutes/);
    assert.equal(llm.max_history, 40);
  });

  it('uses semantic end-of-speech with pause intent by default', () => {
    const eos = propertiesFor('semantic').turn_detection!.config!.end_of_speech!;
    assert.equal(eos.mode, 'semantic');
    assert.equal(eos.semantic_config?.pause_state_enabled, true);
  });

  it('falls back to a longer plain-VAD silence window', () => {
    const eos = propertiesFor('vad').turn_detection!.config!.end_of_speech!;
    assert.equal(eos.mode, 'vad');
    assert.ok((eos.vad_config?.silence_duration_ms ?? 0) >= 1000);
  });
});

describe('isAlreadyStopped', () => {
  it('treats 404 and "already shutting down" as stopped', () => {
    assert.ok(isAlreadyStopped({ statusCode: 404 }));
    assert.ok(
      isAlreadyStopped({
        statusCode: 400,
        body: { reason: 'InvalidRequest', detail: 'Agent is already in the process of shutting down' },
      }),
    );
  });
  it('does not swallow real failures', () => {
    assert.ok(!isAlreadyStopped({ statusCode: 500 }));
    assert.ok(!isAlreadyStopped(new Error('boom')));
    assert.ok(!isAlreadyStopped(null));
  });
});

describe('env', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('accepts both our credential names and the Agora quickstart names', () => {
    delete process.env.AGORA_APP_ID;
    delete process.env.AGORA_APP_CERTIFICATE;
    delete process.env.NEXT_PUBLIC_AGORA_APP_ID;
    delete process.env.NEXT_AGORA_APP_CERTIFICATE;
    assert.equal(getAgoraCredentials(), null);

    process.env.NEXT_PUBLIC_AGORA_APP_ID = 'id1';
    process.env.NEXT_AGORA_APP_CERTIFICATE = 'cert1';
    assert.deepEqual(getAgoraCredentials(), { appId: 'id1', appCertificate: 'cert1' });

    process.env.AGORA_APP_ID = 'id2';
    process.env.AGORA_APP_CERTIFICATE = 'cert2';
    assert.deepEqual(getAgoraCredentials(), { appId: 'id2', appCertificate: 'cert2' });
  });

  it('access code: open when unset, exact match when set', () => {
    delete process.env.COACH_ACCESS_CODE;
    assert.ok(checkAccessCode(undefined));
    process.env.COACH_ACCESS_CODE = 'let-me-in';
    assert.ok(checkAccessCode('let-me-in'));
    assert.ok(!checkAccessCode('let-me-in '));
    assert.ok(!checkAccessCode('LET-ME-IN'));
    assert.ok(!checkAccessCode(''));
    assert.ok(!checkAccessCode(null));
  });
});
