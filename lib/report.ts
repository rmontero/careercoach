import { READINESS_LABEL, type Feedback, type TranscriptTurn } from './feedback';
import { INTERVIEWER_NAME, getLevel, getType, type SessionConfig } from './interview';

export function transcriptToText(transcript: TranscriptTurn[]): string {
  return transcript
    .map((t) => `${t.speaker === 'interviewer' ? INTERVIEWER_NAME : 'You'}: ${t.text}`)
    .join('\n\n');
}

export function reportToMarkdown(
  feedback: Feedback,
  config: SessionConfig,
  transcript: TranscriptTurn[],
  durationSeconds: number,
): string {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  const lines: string[] = [
    `# Interview feedback: ${getType(config.type).label} (${getLevel(config.level).label})`,
    '',
    `${READINESS_LABEL[feedback.readiness]} · ${feedback.overall_score}/5 · ${minutes} min`,
    '',
    feedback.summary,
    '',
    '## Scores',
    ...feedback.dimensions.flatMap((d) => [
      `- **${d.name}: ${d.score}/5.** ${d.evidence} *Tip: ${d.advice}*`,
    ]),
    '',
    '## What went well',
    ...feedback.strengths.map((s) => `- ${s}`),
    '',
    '## Work on next',
    ...feedback.improvements.flatMap((i) => [
      `- **${i.issue}**`,
      `  - Why it matters: ${i.why_it_matters}`,
      `  - Try instead: ${i.try_instead}`,
    ]),
    '',
    '## Practice plan',
    ...feedback.practice_plan.map((p) => `- [ ] ${p}`),
    '',
    '## Transcript',
    '',
    transcriptToText(transcript),
    '',
  ];
  return lines.join('\n');
}
