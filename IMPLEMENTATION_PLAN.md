# Fish Audio POC — "VOLA-lite" Voice Agent (Implementation Plan)

## Context

VOLA is a production voice-calling product built on **ElevenLabs Conversational AI** (see `elevenlabs-capabilities.md`). ElevenLabs there is the voice + telephony + conversation-orchestration layer: ASR, TTS, turn-taking, telephony (Twilio/SIP), batch dispatch, agent orchestration, webhook tools, post-call webhooks, transcripts, and RAG. The "brain" is already external (LLM overridden to `qwen36-35b-a3b`; lead-scoring/task-extraction on OpenAI).

This project (`fish-audio-poc`) is a **greenfield workspace** (only research docs + shadcn skills; no code, not a git repo). Its goal: **prove whether Fish Audio can replace ElevenLabs** for VOLA.

**Key research finding:** Fish Audio's **Voice Agents platform** (not just its TTS API) maps to most of VOLA's ElevenLabs surface — a full agents REST API, **custom LLM override** (OpenAI-compatible, exactly matching VOLA's qwen-bypass), outbound + inbound phone calls, webhook tools, dynamic variables, HMAC-signed webhooks, transcript/recording retrieval, RAG, turn-taking, and post-call analysis. The managed platform runs the ASR→LLM→TTS pipeline server-side over LiveKit WebRTC, and bridges to PSTN via Twilio-provider numbers — so the μ-law/8kHz concern only applies if you build the raw TTS/STT pipeline yourself, which this POC does **not**.

**Decisions locked (via clarifying questions):**
- **Scope:** Thin vertical slice — prove one end-to-end loop, minimal UI.
- **Telephony:** Browser voice session first (web SDK over LiveKit WebRTC) — no phone number to buy, zero telephony cost. PSTN deferred.
- **Agent LLM:** Fish Audio built-in LLM for the POC (custom LLM wiring deferred).
- **Stack:** Next.js + TypeScript + shadcn/ui (matches VOLA; reuses installed skills).

**Intended outcome:** A running Next.js app where you create+publish a Fish Audio agent, hold a live browser voice conversation with it, and afterward see the transcript, recording, and auto-generated post-call analysis (summary + extracted data fields + success criteria) — demonstrating the core replacement loop and surfacing the real gaps for a go/no-go call.

---

## The vertical-slice loop this POC proves

```
create + publish agent (API)  →  mint session token (API)  →
browser voice chat via web SDK (LiveKit WebRTC)  →  call ends  →
HMAC-verified webhook (call.ended / call.analyzed)  →
fetch transcript + recording + analysis (API)  →  show in dashboard
```

---

## Prerequisites (confirm before coding)

- **Fish Audio API key** with Voice Agents access → `FISH_API_KEY`. Get at <https://fish.audio/app/api-keys/>.
- **Webhook secret** for HMAC verification of Fish → app callbacks → `FISH_WEBHOOK_SECRET` (configured in the Fish console webhook settings).
- A **public HTTPS tunnel** for the webhook receiver during dev (ngrok / Cloudflare Tunnel) → `PUBLIC_BASE_URL`.
- The `.claude/settings.local.json` currently only allows `WebFetch(domain:docs.fish.audio)`; installing npm deps / running dev server will need approval or an allowlist entry.

---

## Implementation steps

### 1. Scaffold the app
- `npx create-next-app@latest` (App Router, TypeScript, Tailwind) in the repo root.
- `npx shadcn@latest init`, then add components as needed (`button`, `card`, `table`, `badge`, `dialog`, `scroll-area`) — use the installed **`shadcn`** skill for correct commands/patterns.
- `git init` (repo is not yet under version control).
- Add `.env.local` with `FISH_API_KEY`, `FISH_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `FISH_API_BASE=https://api.fish.audio`. Commit a `.env.example`.
- Install the Fish web SDK: `@fishaudio/agent-react` (+ `@fishaudio/agent-client`).

### 2. Fish Audio server client — `lib/fish.ts`
Central integration module (the POC analogue of VOLA's `lib/elevenlabs.ts`). Thin `fetch` wrappers, all sending `Authorization: Bearer $FISH_API_KEY`, base `https://api.fish.audio`:
- `createAgent(name)` → `POST /v1/agent/agents`
- `updateAgentConfig(id, config)` → `PATCH /v1/agent/agents/{id}/config` (deep-merge `prompt`, `voice`, `conversation`, `analysis`)
- `publishAgent(id)` → `POST /v1/agent/agents/{id}/publish` *(sessions 409 until published)*
- `createSession(agentId, {dynamic_variables?, overrides?})` → `POST /v1/agent/sessions` → single-use `token`
- `getSession(id)` → `GET /v1/agent/sessions/{id}` (merged timeline: messages / tool_call / tool_result)
- `getRecording(id)` → `GET /v1/agent/sessions/{id}/recording` (per-speaker signed URLs)
- `listSessions(filters)` → `GET /v1/agent/sessions`

### 3. Agent provisioning — `scripts/setup-agent.ts` (run-once)
Create → configure → publish one demo agent. Config to set:
- `prompt.system_prompt` (VOLA-style sales/qualification prompt; keep < 2,000 tokens, hard cap 4,000).
- `voice.voice_id` + `voice.speaking_language`.
- `conversation`: `eagerness`, `interruptible`, `interruption_sensitivity`, `record_audio: true`.
- `analysis`: `summary {enabled}`, `data_fields[]` (e.g. `interested:boolean`, `budget:number`, `callback_time:text` — this is the POC's **lead-scoring/extraction** analogue), `criteria[]` (e.g. `qualified` success criterion).
- LLM: leave as **Fish built-in** (custom LLM deferred).
- Persist the returned `agent_id` to `.env.local` / a small `agent.json`.

### 4. Session-token API route — `app/api/session/route.ts`
`POST` → calls `createSession(agentId)` server-side (keeps `FISH_API_KEY` off the client) → returns the short-lived single-use `token`. Optionally accept `dynamic_variables` (contact name/company) to mirror VOLA's per-call personalization.

### 5. Browser voice UI — `app/page.tsx` (+ `components/`)
Use `@fishaudio/agent-react`:
- Wrap in `AgentSessionProvider`; use `useConversation` (`startSession` with the fetched `sessionToken`, `endSession`, `status`, `isSpeaking`, `interrupt`, `setMicMuted`).
- shadcn UI: a "Start call" card, live status/`isSpeaking` indicator, and a live transcript pane fed by `userTranscript` / `agentResponseDelta` (or `useAgentMessages`), plus `<AgentAudioVisualizer>`.
- On `disconnect`, capture the `session_id` and route the user to the call-detail view.

### 6. Webhook receiver — `app/api/webhooks/fish/route.ts`
Mirror VOLA's signed-webhook pattern (`app/api/webhooks/elevenlabs/route.ts`):
- Verify `X-Fish-Webhook-Signature: t=…,v1=…` = HMAC-SHA256 over `` `${t}.${rawBody}` `` with `FISH_WEBHOOK_SECRET`; reject > 5 min old; `crypto.timingSafeEqual`.
- Handle `call.ended` (+`ended_reason`) and `call.analyzed` (+`analysis`).
- **Gotcha (confirmed in research):** webhook payloads **omit transcript & recording** — on `call.analyzed`, trigger a follow-up `getSession(id)` + `getRecording(id)` to hydrate the record.
- Persist to a lightweight store (SQLite via Prisma, or a JSON file for the POC) — a `sessions` table: `id`, `status`, `summary`, `analysis` (data_fields + criteria), `transcript`, `recordingUrl`, timestamps.

### 7. Dashboard — `app/calls/page.tsx` + `app/calls/[id]/page.tsx`
- List view (shadcn `table`): recent sessions with status, summary, and a derived "lead" badge from `analysis.criteria`/`data_fields`.
- Detail view: full transcript timeline, per-speaker recording playback, and the extracted `data_fields` + `criteria` results.

---

## Explicit non-goals for this slice (deferred)
Batch/scheduled dispatch (Fish has none — would be a home-grown queue), real PSTN outbound/inbound + phone-number provisioning, custom LLM (qwen) wiring, webhook tools (appointments/inventory), transfers, RAG/KB sync, OpenAI lead-scoring/task-extraction, CRM push. Each is a follow-on once the core loop is proven.

## Known gaps to document as POC findings (for the go/no-go)
1. **No batch/scheduled calling** — must build your own queue; **200 outbound calls/workspace/day + 10 concurrent** hard ceiling.
2. **Webhooks omit transcript/recording** — extra fetch per call.
3. **Only 2 system tools** (`hang_up_call`, `transfer_call`) — no voicemail-detection tool (only `answered_by` on `phone_call.dial_finished`), no language-detection tool (language is fixed per session).
4. **Transfers Twilio-only, single destination**; SIP numbers can't be transfer targets.
5. **KB ingestion `.md`/`.txt` only** (≤1 MB) — no PDF/URL/Office.
6. **Twilio number inventory US/Canada only** (SIP BYO mitigates, but loses transfer).
7. **Custom dynamic variables don't reach webhook tools** — only `{{system.*}}` do; pass contact data as explicit tool args.

---

## Verification (end-to-end)

1. **Setup:** run `scripts/setup-agent.ts`; confirm the agent is created **and published** (GET the agent, check published version exists — sessions 409 otherwise).
2. **Token:** `curl -XPOST localhost:3000/api/session` returns a non-empty single-use `token`.
3. **Live loop (the core test):** open the app, click "Start call", speak; verify the agent responds in voice, live transcript updates, and interruption works.
4. **Webhook:** with the tunnel live and the Fish console pointed at `PUBLIC_BASE_URL/api/webhooks/fish`, end a call and confirm `call.ended` then `call.analyzed` arrive and **pass HMAC verification** (log a rejected tampered payload to prove the check).
5. **Hydration:** confirm the record gets transcript + recording URL + `analysis` after the follow-up `getSession`/`getRecording` calls.
6. **Dashboard:** the call appears in the list with a summary and lead badge; detail view shows transcript, playable recording, and extracted `data_fields`/`criteria`.
7. Use the **`verify`** skill to drive the browser flow if you want an automated end-to-end pass.

**Success =** one full browser conversation flows through to a hydrated, analyzed call record in the dashboard, with a signed webhook verified — demonstrating Fish Audio covers VOLA's core agent/analysis loop, with the gaps above documented.
