# VOLA-lite — Fish Audio POC

A thin vertical-slice proof-of-concept that rebuilds **VOLA's core voice-agent loop**
on the **[Fish Audio Voice Agents platform](https://docs.fish.audio/agents)**, to
evaluate Fish Audio as a replacement for ElevenLabs Conversational AI.

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the full plan and the
research behind it, [`FISH_AUDIO_CAPABILITIES.md`](./FISH_AUDIO_CAPABILITIES.md) for
the Fish Audio API surface, and [`elevenlabs-capabilities.md`](./elevenlabs-capabilities.md)
for the VOLA baseline being replaced.

## What this proves

```
create + publish agent (script)  →  mint session token (/api/session)  →
browser voice chat via Fish web SDK (LiveKit WebRTC)  →  call ends  →
HMAC-verified webhook (/api/webhooks/fish)  →
hydrate transcript + recording + analysis (read API)  →  dashboard (/calls)
```

The agent runs **Fish Audio's built-in LLM**; telephony is deferred in favour of an
in-browser voice session (no phone number, zero telephony cost).

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **shadcn/ui** (base-nova, lucide icons)
- **`@fishaudio/agent-react` / `agent-client`** — browser voice SDK (LiveKit WebRTC)
- File-backed JSON store (`/data/calls.json`) — swap for SQLite/Prisma for real use

## Project layout

| Path | Role |
|------|------|
| `lib/fish.ts` | Central Fish REST client (agents, sessions, recording) — the analogue of VOLA's `lib/elevenlabs.ts` |
| `lib/webhook.ts` | HMAC-SHA256 webhook signature verification |
| `lib/store.ts` | Minimal JSON call-record store |
| `lib/lead.ts` | Derives a hot/warm/cold lead label from post-call analysis |
| `scripts/setup-agent.ts` | Run-once: create → configure → publish the demo agent |
| `app/api/session/route.ts` | Mints a single-use browser session token (keeps the API key server-side) |
| `app/api/webhooks/fish/route.ts` | Signed webhook receiver; hydrates transcript + recording |
| `app/page.tsx` + `components/voice-call.tsx` | Browser voice UI |
| `app/calls/*` | Dashboard: list + call detail (summary, analysis, recording, transcript) |

## Getting started

1. **Install** (already done if you're reading this in a built checkout):
   ```bash
   npm install
   ```
   > Note: the Fish SDK packages ship with `workspace:^` dependency specifiers that
   > npm can't resolve directly. This repo pins them via `overrides` in `package.json`
   > — keep that block if you bump the SDK versions.

2. **Configure** — copy `.env.example` to `.env.local` and fill in:
   - `FISH_API_KEY` — from <https://fish.audio/app/api-keys/> (needs Voice Agents access)
   - `FISH_WEBHOOK_SECRET` — matching the value you set in the Fish console webhook
   - `PUBLIC_BASE_URL` — a public HTTPS tunnel (ngrok / Cloudflare Tunnel) for webhooks

3. **Create the agent**:
   ```bash
   npm run setup:agent
   ```
   Copy the printed `FISH_AGENT_ID=…` into `.env.local`.

4. **Point the Fish console webhook** at `${PUBLIC_BASE_URL}/api/webhooks/fish`.

5. **Run**:
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>, click **Start call**, and talk. After hanging up,
   the call appears under **History** (`/calls`) with its summary, extracted data
   fields, success criteria, recording, and transcript.

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run setup:agent` | Create + configure + publish the demo agent |

## Known gaps vs. ElevenLabs (for the go/no-go)

Carried from the research in `IMPLEMENTATION_PLAN.md`:

1. **No batch/scheduled calling** — build your own queue; **200 outbound calls/workspace/day + 10 concurrent** ceiling.
2. **Webhooks omit transcript & recording** — this POC re-fetches them via the read API (see `hydrate()` in the webhook route).
3. **Only 2 system tools** (`hang_up_call`, `transfer_call`) — no voicemail/language-detection tools.
4. **Transfers Twilio-only, single destination**; SIP numbers can't be transfer targets.
5. **Knowledge base ingestion `.md`/`.txt` only** (≤1 MB).
6. **Twilio number inventory US/Canada only**.
7. **Custom dynamic variables don't reach webhook tools** — only `{{system.*}}` do.
8. **SDK packaging** — the official web SDKs publish with unresolved `workspace:^` deps; this repo works around it with npm `overrides`.

## Deferred (follow-ons once the loop is proven)

Real PSTN outbound/inbound + phone-number provisioning, custom LLM (qwen) wiring,
batch queue, webhook tools (appointments/inventory), transfers, RAG/KB sync,
OpenAI lead-scoring/task-extraction, CRM push.
