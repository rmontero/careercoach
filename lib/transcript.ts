import {
  TurnStatus,
  type AgentTranscription,
  type TranscriptHelperItem,
  type UserTranscription,
} from 'agora-agent-client-toolkit';
import type { TranscriptTurn } from './feedback';

export type RawTranscriptItem = TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>;

export interface Turn {
  id: string;
  speaker: TranscriptTurn['speaker'];
  text: string;
  inProgress: boolean;
}

/**
 * Some ASR/TTS providers emit sentence punctuation glued to the next word
 * ("Hello.World"). Restore the space so captions and the feedback prompt read cleanly.
 */
export function tidyText(text: string): string {
  return text
    .replace(/([.!?])([A-Za-z])/g, '$1 $2')
    .replace(/,([A-Za-z])/g, ', $1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Maps the toolkit's transcript items to speaker-labelled turns. Anything not spoken by
 * the agent is the candidate (the toolkit uses uid "0" for local speech), and empty
 * partials are dropped.
 */
export function toTurns(raw: RawTranscriptItem[], agentUid: string): Turn[] {
  const turns: Turn[] = [];
  raw.forEach((item, index) => {
    const text = typeof item.text === 'string' ? tidyText(item.text) : '';
    if (!text) return;
    turns.push({
      id: `${index}-${item.turn_id}-${item.uid}`,
      speaker: String(item.uid) === agentUid ? 'interviewer' : 'candidate',
      text,
      inProgress: item.status === TurnStatus.IN_PROGRESS,
    });
  });
  return turns;
}

export function toFeedbackTranscript(turns: Turn[]): TranscriptTurn[] {
  return turns.map(({ speaker, text }) => ({ speaker, text: text.slice(0, 4000) }));
}
