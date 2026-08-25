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
sign up / log in (Supabase Auth)  →  create + publish an agent in-app (/agents/new)  →
mint session token (/api/session)  →  browser voice chat via Fish web SDK (LiveKit WebRTC)  →
call ends  →  HMAC-verified webhook (/api/webhooks/fish)  →
hydrate transcript + recording + analysis (read API)  →  dashboard (/calls)
```

A multi-user dashboard: each user logs in, builds and configures their own Fish Audio
agents, tests them in the browser, and reviews call history — all scoped per user by
Postgres RLS. The agent runs **Fish Audio's built-in LLM**; telephony is deferred in
favour of an in-browser voice session (no phone number, zero telephony cost).

## Stack

- **Next.js 16** (App Router, `proxy.ts`) + TypeScript + Tailwind v4
- **shadcn/ui** (base-nova, lucide icons)
- **Supabase** — Auth (email/password) + Postgres with Row-Level Security
- **`@fishaudio/agent-react` / `agent-client`** — browser voice SDK (LiveKit WebRTC)

## Project layout

| Path | Role |
|------|------|
| `lib/fish.ts` | Central Fish REST client (agents, sessions, recording, voices) |
| `lib/webhook.ts` | HMAC-SHA256 webhook signature verification |
| `lib/supabase/{server,client,admin}.ts` | Supabase clients (RLS server, browser, service-role) |
| `proxy.ts` + `lib/supabase/middleware.ts` | Session refresh + auth gate |
| `lib/agents.ts` / `lib/calls.ts` | Supabase-backed agent + call records |
| `lib/agent-config.ts` | Shared form-input → Fish AgentConfig builder |
| `lib/lead.ts` | Derives a hot/warm/cold lead label from post-call analysis |
| `supabase/migrations/0001_init.sql` | `agents` + `calls` tables with RLS |
| `app/auth-actions.ts`, `app/login`, `app/signup` | Supabase Auth server actions + pages |
| `app/(dashboard)/*` | Auth-gated shell: agents list, `/agents/new`, `/agents/[id]` (Test/Config), `/calls` |
| `app/api/agents/*`, `app/api/voices` | Create/list agents; voice picker |
| `app/api/session/route.ts` | Mints a single-use session token for the selected agent |
| `app/api/webhooks/fish/route.ts` | Signed webhook receiver; hydrates transcript + recording |
| `components/agent-form.tsx`, `components/voice-call.tsx` | Agent builder + browser voice UI |

## Getting started

1. **Install** (already done if you're reading this in a built checkout):
   ```bash
   npm install
   ```
   > Note: the Fish SDK packages ship with `workspace:^` dependency specifiers that
   > npm can't resolve directly. This repo pins them via `overrides` in `package.json`
   > — keep that block if you bump the SDK versions.

2. **Create a Supabase project**, then run the migration
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) in the
   Supabase SQL editor (or `supabase db push`). It creates the `agents` + `calls`
   tables with RLS. Email confirmation can be disabled in Auth settings for a
   frictionless dev signup.

3. **Configure** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     — from Supabase → Settings → API
   - `FISH_API_KEY` — from <https://fish.audio/app/api-keys/> (needs Voice Agents access)
   - `FISH_WEBHOOK_SECRET` — matching the value you set in the Fish console webhook
   - `PUBLIC_BASE_URL` — a public HTTPS tunnel (ngrok / Cloudflare Tunnel) for webhooks

4. **Point the Fish console webhook** at `${PUBLIC_BASE_URL}/api/webhooks/fish`.

5. **Run**:
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000> → you're sent to **/login**. Sign up, then:
   **New agent** → fill the form (it runs Fish create → config → publish) → open the
   agent → **Test** tab → **Start call** and talk. After hanging up, the call appears
   under **History** (`/calls`) with its summary, extracted data fields, success
   criteria, recording, and transcript — visible only to you (RLS).

> `scripts/setup-agent.ts` (`npm run setup:agent`) remains as a standalone CLI way to
> create a single agent; the dashboard is the primary flow now.

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run setup:agent` | (Legacy) create + configure + publish one agent from the CLI |

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
