'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, {
  RemoteUser,
  useClientEvent,
  useJoin,
  useLocalMicrophoneTrack,
  usePublish,
  useRTCClient,
  useRemoteUsers,
} from 'agora-rtc-react';
import { AgoraVoiceAI, AgoraVoiceAIEvents, TranscriptHelperMode } from 'agora-agent-client-toolkit';
import type { RTMClient } from 'agora-rtm';
import type { StartedSession } from '@/lib/api';
import type { TranscriptTurn } from '@/lib/feedback';
import { CLOSING_MATCHER, INTERVIEWER_NAME, type SessionConfig } from '@/lib/interview';
import { toFeedbackTranscript, toTurns, type RawTranscriptItem } from '@/lib/transcript';
import type { OrbState } from './Orb';
import { RoomView } from './RoomView';

export interface RoomResult {
  transcript: TranscriptTurn[];
  durationSeconds: number;
}

interface InterviewRoomProps {
  session: StartedSession;
  rtmClient: RTMClient;
  config: SessionConfig;
  onFinish: (result: RoomResult) => void;
}

/** How long we wait for the cloud agent to appear in the channel before flagging a problem. */
const AGENT_JOIN_WARNING_SECONDS = 25;
/** End slightly before the agent's own token expires so the wrap-up is ours, not a dropped call. */
const CAP_MARGIN_SECONDS = 10;
/** Show a heads-up when this little time remains. */
const LOW_TIME_SECONDS = 120;

export default function InterviewRoom({ session, rtmClient, config, onFinish }: InterviewRoomProps) {
  const client = useRTCClient();
  const remoteUsers = useRemoteUsers();

  const [rawTranscript, setRawTranscript] = useState<RawTranscriptItem[]>([]);
  const [agentState, setAgentState] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [agentIssue, setAgentIssue] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState('CONNECTING');

  // React StrictMode mounts effects twice in dev. Delaying "ready" behind a timeout means the
  // fake first mount is cancelled before it can join the channel or create a mic track, so we
  // join exactly once. (Same guard as Agora's official Next.js quickstart.)
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setIsReady(true), 0);
    return () => {
      clearTimeout(id);
      setIsReady(false);
    };
  }, []);

  const { isConnected: joined } = useJoin(
    {
      appid: session.appId,
      channel: session.channel,
      token: session.token,
      uid: parseInt(session.uid, 10),
    },
    isReady,
  );
  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(isReady);
  usePublish([localMicrophoneTrack]);

  useClientEvent(client, 'connection-state-change', (state) => setConnectionState(state));

  // Needed for accurate transcript timing; must be set before audio is published.
  useEffect(() => {
    try {
      (AgoraRTC as unknown as { setParameter?: (k: string, v: unknown) => void }).setParameter?.(
        'ENABLE_AUDIO_PTS',
        true,
      );
    } catch (error) {
      console.warn('Could not set ENABLE_AUDIO_PTS:', error);
    }
  }, []);

  // Transcript + agent state arrive over RTM, wired up by the Agora client toolkit once we've joined.
  useEffect(() => {
    if (!isReady || !joined) return;
    let cancelled = false;

    (async () => {
      try {
        const ai = await AgoraVoiceAI.init({
          rtcEngine: client,
          rtmEngine: rtmClient,
          renderMode: TranscriptHelperMode.TEXT,
          enableLog: false,
        });
        if (cancelled) {
          try {
            if (AgoraVoiceAI.getInstance() === ai) {
              ai.unsubscribe();
              ai.destroy();
            }
          } catch {}
          return;
        }
        ai.on(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, (items) => setRawTranscript([...items]));
        ai.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (_, event) => setAgentState(event.state));
        ai.on(AgoraVoiceAIEvents.AGENT_ERROR, (_, error) => setAgentIssue(`${error.type}: ${error.message}`));
        ai.on(AgoraVoiceAIEvents.MESSAGE_ERROR, (_, error) => setAgentIssue(error.message));
        ai.subscribeMessage(session.channel);
      } catch (error) {
        if (!cancelled) {
          console.error('Could not start the transcript feed:', error);
          setAgentIssue('Live transcript is unavailable, but the interview can continue.');
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        const ai = AgoraVoiceAI.getInstance();
        if (ai) {
          ai.unsubscribe();
          ai.destroy();
        }
      } catch {}
    };
    // The RTC client and RTM client are stable for the life of the room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, joined]);

  const agentPresent = remoteUsers.some((u) => String(u.uid) === session.agentUid);
  const turns = useMemo(() => toTurns(rawTranscript, session.agentUid), [rawTranscript, session.agentUid]);
  const lastInterviewerTurn = useMemo(() => [...turns].reverse().find((t) => t.speaker === 'interviewer'), [turns]);
  const interviewComplete = turns.some(
    (t) => t.speaker === 'interviewer' && !t.inProgress && CLOSING_MATCHER.test(t.text),
  );

  // --- Session clock (starts when we're in the channel) ---
  const joinedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!joined) return;
    joinedAt.current ??= Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (joinedAt.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [joined]);

  // --- Finish (manual, or automatically at the session cap) ---
  const finished = useRef(false);
  const latest = useRef({ turns, elapsed });
  useEffect(() => {
    latest.current = { turns, elapsed };
  });
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinish({
      transcript: toFeedbackTranscript(latest.current.turns),
      durationSeconds: latest.current.elapsed,
    });
  }, [onFinish]);

  const remaining = session.capSeconds - elapsed;
  useEffect(() => {
    if (joined && remaining <= CAP_MARGIN_SECONDS) finish();
  }, [joined, remaining, finish]);

  // --- Mic level → orb (gives immediate proof the mic works) ---
  // The level is written to a wrapper element as a CSS variable, which the orb inherits, so no
  // ref has to be threaded through props and React never re-renders at animation-frame rate.
  const levelHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!localMicrophoneTrack) return;
    let raf = 0;
    const tick = () => {
      const level = micOn ? Math.min(1, localMicrophoneTrack.getVolumeLevel() * 2.2) : 0;
      levelHost.current?.style.setProperty('--level', level.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [localMicrophoneTrack, micOn]);

  const toggleMic = useCallback(async () => {
    if (!localMicrophoneTrack) return;
    const next = !micOn;
    try {
      // Mute via setEnabled only; usePublish owns the publish state.
      await localMicrophoneTrack.setEnabled(next);
      setMicOn(next);
    } catch (error) {
      console.error('Could not toggle the microphone:', error);
    }
  }, [localMicrophoneTrack, micOn]);

  // Two-step end so a stray tap doesn't throw away a session in progress.
  useEffect(() => {
    if (!confirmingEnd) return;
    const id = setTimeout(() => setConfirmingEnd(false), 4000);
    return () => clearTimeout(id);
  }, [confirmingEnd]);

  const onEnd = () => {
    if (interviewComplete || confirmingEnd || turns.length === 0) finish();
    else setConfirmingEnd(true);
  };

  // --- View model ---
  const connecting = !joined || !agentPresent;
  const orbState: OrbState = connecting
    ? 'connecting'
    : agentState === 'speaking'
      ? 'speaking'
      : agentState === 'thinking'
        ? 'thinking'
        : !micOn
          ? 'muted'
          : 'listening';
  const stateLabel = micError
    ? 'Microphone unavailable'
    : connecting
      ? joined
        ? `Waiting for ${INTERVIEWER_NAME} to join…`
        : 'Connecting…'
      : orbState === 'speaking'
        ? `${INTERVIEWER_NAME} is speaking`
        : orbState === 'thinking'
          ? `${INTERVIEWER_NAME} is thinking`
          : orbState === 'muted'
            ? 'You’re muted'
            : 'Listening to you';

  return (
    <div ref={levelHost} className="contents">
      <RoomView
        config={config}
        elapsed={elapsed}
        joined={joined}
        orbState={orbState}
        stateLabel={stateLabel}
        turns={turns}
        caption={lastInterviewerTurn?.text}
        micOn={micOn}
        micAvailable={Boolean(localMicrophoneTrack)}
        micBlocked={Boolean(micError)}
        agentLate={joined && !agentPresent && elapsed >= AGENT_JOIN_WARNING_SECONDS}
        reconnecting={connectionState === 'RECONNECTING' || connectionState === 'DISCONNECTED'}
        minutesLeft={
          remaining > CAP_MARGIN_SECONDS && remaining <= LOW_TIME_SECONDS
            ? Math.max(1, Math.ceil(remaining / 60))
            : null
        }
        agentIssue={agentIssue}
        onDismissIssue={() => setAgentIssue(null)}
        interviewComplete={interviewComplete}
        confirmingEnd={confirmingEnd}
        onToggleMic={toggleMic}
        onEnd={onEnd}
      >
        {/* The agent's voice is a remote audio track; RemoteUser plays it. */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="hidden">
            <RemoteUser user={user} />
          </div>
        ))}
      </RoomView>
    </div>
  );
}
