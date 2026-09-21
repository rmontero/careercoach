# Career Coach

Practice the interview before it counts. **Career Coach** is a voice-first mock interviewer for engineers: you talk to a live AI interviewer (behavioral, system design, coding, frontend, backend, or engineering leadership), and when you finish you get a scorecard grounded in what you actually said.

Live at <https://www.career-coach.cc> (Vercel); `career-coach.cc` redirects there. This is a proof of concept.

## How it works

Live voice runs on **[Agora's Conversational AI Engine](https://docs.agora.io/en/ai)**: a cloud agent joins an Agora RTC channel with the candidate and runs the ASR → LLM → TTS pipeline in Agora's network. The browser only captures the microphone, plays the agent's audio, and renders transcripts.

```
Browser (Next.js client)                     Next.js API routes (Vercel)               Agora cloud
────────────────────────                     ───────────────────────────               ───────────
Setup screen ── POST /api/session/start ───▶ validate + access-code gate
                                             mint RTC+RTM token (expires at session cap)
                                             build interviewer prompt (server-only) ──▶ POST …/join
                                             ◀── { channel, token, agentId } ─────────  agent joins channel
RTM login + RTC join (agora-rtc-react) ◀═══════════ real-time voice (SD-RTN) ═══════════▶ ASR → LLM → TTS
transcript + agent state over RTM (agora-agent-client-toolkit)
End ─────────────── POST /api/session/stop ─▶ …/agents/{id}/leave
    ───────────── POST /api/feedback ───────▶ Claude (structured JSON) ──▶ scorecard
```

### Product decisions worth knowing

- **Interview-shaped turn taking.** Candidates pause mid-thought, so the agent uses Agora's *semantic* end-of-speech detection with pause intent ("give me a second") instead of a fixed silence timer. If a project can't use semantic mode the server retries once with a longer plain-VAD window.
- **Varied, calibrated interviews.** Six interview types × four levels × three lengths. Each session opens with a question drawn server-side from a per-type/level bank (LLMs left alone converge on the same first question), and the prompt tells the interviewer how to pace, probe, and behave in a spoken medium.
- **Prompts stay server-side.** The browser sends only validated choices (`type`, `level`, `length`, ≤600 chars of notes). Notes are wrapped in a delimiter the candidate can't close.
- **Feedback from the transcript, by Claude.** The transcript goes to `claude-opus-5` with a structured-output schema (readiness, per-dimension scores with quoted evidence, strengths, improvements with "try instead", practice plan). Nothing is invented about the candidate's experience; suggested wording uses placeholders like `[the metric]`.
- **Bounded cost per session.** The candidate's token and the agent's own token expire at the session cap (15 / 28 / 40 minutes by length), which is the hard limit. The agent also has a 60 s idle timeout as a best-effort extra for abandoned tabs, the LLM output is capped at 400 tokens per turn, and an optional access code gates the expensive endpoints.

## Run it locally

Requires Node 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in your keys (see below)
pnpm dev                      # http://localhost:3000
```

Without credentials the app still loads and tells you what's missing.

### Agora setup (needed for voice)

1. Create an [Agora Console](https://console.agora.io) project with the **App Certificate** enabled, and make sure **Conversational AI** is enabled for it (see the [quickstart](https://docs.agora.io/en/ai/get-started/quickstart)).
2. Put the App ID and certificate in `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE`.

Speech-to-text (Deepgram), the interviewer LLM (OpenAI), and text-to-speech (MiniMax) use Agora's **managed** presets, so no other vendor keys are required.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | yes (for voice) | Agora project credentials. The official quickstart's `NEXT_PUBLIC_AGORA_APP_ID` / `NEXT_AGORA_APP_CERTIFICATE` are also accepted. |
| `ANTHROPIC_API_KEY` | recommended | Enables the post-interview feedback report. |
| `COACH_ACCESS_CODE` | recommended for public deploys | If set, visitors must enter it to start an interview or request feedback. |
| `COACH_LLM_MODEL` | no | `gpt-4.1-mini` (default) or `gpt-4o-mini`. |
| `COACH_TTS_VOICE_ID` | no | MiniMax voice id for the interviewer. |
| `COACH_FEEDBACK_MODEL` | no | Defaults to `claude-opus-5`; `claude-sonnet-5` is faster and cheaper. |

## Deploy to Vercel (www.career-coach.cc)

1. Import this repo as a Vercel project. `vercel.json` pins the framework to Next.js, so it builds correctly even if the project was first created while the repo was empty (Vercel then guesses "Node" and fails with `No entrypoint found`).
2. Add the environment variables above (Production, and Preview if you want previews to work).
3. Add the domains: Project → Settings → Domains → `www.career-coach.cc` (the canonical host) and `career-coach.cc` set to redirect to it. Follow Vercel's DNS instructions at the registrar. If you ever change the canonical host, update `SITE_URL` in `app/layout.tsx` to match, since it drives the canonical link and Open Graph URL.
4. Deploy. The feedback route sets `maxDuration = 60`, which fits every plan.

CLI equivalent:

```bash
vercel link
vercel env add AGORA_APP_ID production        # repeat for the other variables
vercel --prod
vercel domains add www.career-coach.cc   # then add career-coach.cc with a redirect to www
```

If the Vercel install step complains about the package manager, set `ENABLE_EXPERIMENTAL_COREPACK=1` so it uses the pinned pnpm from `package.json`.

> **Before making the site public:** set `COACH_ACCESS_CODE` and consider a rate limit via Vercel's WAF. Each session spends real money, and this PoC has no user accounts or per-user quotas.

## Project layout

```
app/                    Next.js app router (page, layout, API routes)
  api/session/start     mint tokens + start the Agora agent
  api/session/stop      stop the agent (idempotent)
  api/feedback          transcript → structured feedback via Claude
  api/status            what's configured (drives the setup screen)
components/             Setup, live room (Agora hooks), room view (pure UI), report
lib/interview.ts        client-safe catalog: types, levels, lengths, schemas
lib/interviewer.ts      server-only: question banks + interviewer prompt
lib/server/agent.ts     Agora agent construction, start/stop, VAD fallback
lib/server/feedback.ts  Claude call + rubric
```

## Checks

```bash
pnpm run verify   # lint + typecheck + unit tests + production build
```

Unit tests cover prompt construction (including notes-injection safety), the exact Agora payload the SDK builds, the access-code gate, and feedback normalization. The live voice path needs real Agora credentials and a microphone, so it is verified manually.

## Known limitations / next steps

- No accounts or history yet; a session's transcript and report live only in the browser tab.
- One interviewer voice and persona. Per-type personas and accent/voice choice are easy follow-ups.
- Coding interviews are verbal (no shared editor).
- English only.
- ASR may mangle technical terms; Deepgram keyterm hints would help.
- No per-user rate limiting beyond the optional access code.
