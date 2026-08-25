# VOLA ↔ ElevenLabs Integration — Full Capability Reference

> **Purpose**: This document catalogs **everything VOLA does with ElevenLabs** so you can build a Fish Audio POC and evaluate it as a drop-in replacement. Each section lists the feature, the exact ElevenLabs API surface used, the data that flows in/out, and the VOLA files involved.

## TL;DR — What ElevenLabs actually provides here

ElevenLabs is used as VOLA's **voice + telephony + conversation-orchestration layer**, *not* as the brain:

- **LLM is overridden to `qwen36-35b-a3b`** on every agent (ElevenLabs' own LLM is bypassed).
- **Lead scoring & task extraction run on OpenAI**, over the transcript ElevenLabs returns.

So the ElevenLabs responsibilities a replacement must cover are:

| Responsibility | ElevenLabs surface |
|---|---|
| ASR (speech-to-text, live) | `asr` config (scribe_realtime / scribe_v2) |
| TTS (text-to-speech, voices) | `tts` config + voice IDs |
| Turn-taking / interruption / voicemail detection | `turn` + system tools |
| Telephony (outbound + inbound) | Twilio + SIP trunk phone-number integration |
| Batch call dispatch + scheduling | Batch Calling API |
| Conversation agent orchestration (prompt, tools, KB/RAG) | ConvAI Agents API |
| Function/tool calling during a call | Webhook tools + system tools |
| Post-call events | Webhooks (signed) |
| Transcript + audio retrieval | Conversations API |
| Human-transfer recording transcription | Speech-to-Text API |

If Fish Audio only offers TTS (voice cloning / synthesis), it can replace **one slice** of this. The telephony, batch dispatch, live ASR, turn-taking, tool-calling, and webhook orchestration would need a different provider or custom build. **Scope the POC accordingly.**

---

## 1. Environment / Config

| Env var | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | Master key, sent as `xi-api-key` header on every REST call |
| `ELEVENLABS_WEBHOOK_SECRET` | **Dual-purpose**: (1) HMAC verification of inbound webhooks; (2) `Bearer` token the agent sends to VOLA's own tool endpoints |
| `ELEVENLABS_AGENT_PHONE_NUMBER_ID` | Default outbound phone number id |
| `ELEVENLABS_MALE_VOICE_ID` / `ELEVENLABS_FEMALE_VOICE_ID` | Legacy (non-V3) voice IDs |
| `ELEVENLABS_RAG_EMBEDDING_MODEL` | Optional override of RAG embedding model |
| `SLOTY_TOOL_WEBHOOK_SECRET` | Secret header for Sloty appointment webhook tools |
| `VOLA_PUBLIC_BASE_URL` / `SLOTY_PUBLIC_BASE_URL` / `NEXTAUTH_URL` | Public base URL injected into agent webhook-tool URLs (must be public https) |

**Base URL**: `https://api.elevenlabs.io`

**Hardcoded models/voices:**
- LLM (overrides EL default): `qwen36-35b-a3b`
- Legacy TTS models: `eleven_turbo_v2` (English), `eleven_turbo_v2_5` (non-English)
- V3 mode: TTS `eleven_v3_conversational`, ASR `scribe_realtime` (quality `high`, `ulaw_8000`), `turn_model: turn_v2`
- STT (human-transfer only): `scribe_v2`
- RAG embeddings: `e5_mistral_7b_instruct` (English), `multilingual_e5_large_instruct` (multilingual)
- V3 voice IDs: male `TX3LPaxmHKxFdv7VOQHJ`, female `cgSgspJ2msm6clMCkdW9`

**Primary integration file**: `lib/elevenlabs.ts` (~2,356 lines). Nearly all API access is centralized here.

---

## 2. Complete ElevenLabs REST Endpoint Inventory

### Conversational AI Agents
| Method | Endpoint | VOLA function / file |
|---|---|---|
| POST | `/v1/convai/agents/create` | `createElevenLabsAgent()` — body `{ name, conversation_config }` → `{ agent_id }` |
| PATCH | `/v1/convai/agents/{agentId}` | `updateElevenLabsAgent()` — partial `conversation_config` |
| DELETE | `/v1/convai/agents/{agentId}` | `deleteElevenLabsAgent()` |
| GET | `/v1/convai/agents/{agentId}` | `sloty/tool-sync.ts`, `scripts/update-agent-models.ts` |
| GET | `/v1/convai/agents?page_size=&cursor=` | paginated list (`scripts/update-agent-models.ts`) |

### Standalone Tools API (Sloty appointment tools) — `lib/sloty/tool-sync.ts`
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/convai/tools` | list workspace tools |
| GET | `/v1/convai/tools?agent_id=` | list agent tools |
| POST | `/v1/convai/tools` | create webhook tool |
| PATCH | `/v1/convai/tools/{toolId}` | update tool |

### Knowledge Base / RAG
| Method | Endpoint | VOLA function |
|---|---|---|
| POST | `/v1/convai/knowledge-base/text` | `createElevenLabsKbDocument()` — `{ name, text }` → `{ id }` |
| POST | `/v1/convai/knowledge-base/{docId}/rag-index` | `triggerElevenLabsRagIndex()` — `{ model }` |
| GET | `/v1/convai/knowledge-base/{docId}/rag-index` | `getElevenLabsRagIndexStatus()` |
| DELETE | `/v1/convai/knowledge-base/{docId}?force=true` | `deleteElevenLabsKbDocument()` |

### Batch Calling
| Method | Endpoint | VOLA function |
|---|---|---|
| POST | `/v1/convai/batch-calling/submit` | `createBatchCall()` — `{ call_name, agent_id, agent_phone_number_id, recipients[], scheduled_time_unix?, first_message? }` |
| GET | `/v1/convai/batch-calling/{batchCallId}` | `getBatchCallInfo()` — returns `recipients[]{id, phone_number, status, conversation_id}` |
| POST | `/v1/convai/batch-calling/{batchCallId}/cancel` | `cancelBatchCall()` |

> ⚠️ Two call sites use the underscore path `/v1/convai/batch_calling/{id}/cancel` (`campaign-control-service.ts`, `servy/service-reminder-scheduler.ts`).

### Outbound Calling (immediate, non-batch)
| Method | Endpoint | VOLA function |
|---|---|---|
| POST | `/v1/convai/conversation/initiate_outbound_call` | `initiateOutboundCall()` — `{ agent_id, agent_phone_number_id, to_number, first_message?, conversation_initiation_client_data.dynamic_variables }` → `{ conversation_id, call_sid }` |
| POST | `/v1/convai/sip-trunk/outbound-call` | admin test call (SIP) |
| POST | `/v1/convai/twilio/outbound-call` | admin test call (Twilio) |

### Phone Numbers (Twilio + SIP trunk)
| Method | Endpoint | VOLA function |
|---|---|---|
| POST | `/v1/convai/phone-numbers` | `createPhoneNumber()` — Twilio or SIP config |
| GET | `/v1/convai/phone-numbers` | `listPhoneNumbers()` |
| GET | `/v1/convai/phone-numbers/{id}` | `getPhoneNumber()` |
| DELETE | `/v1/convai/phone-numbers/{id}` | `deletePhoneNumber()` |
| PATCH | `/v1/convai/phone-numbers/{id}` | `assignAgentToPhoneNumber()` / `unassignAgentFromPhoneNumber()` (`{agent_id}` / `{agent_id:null}`) |

### Conversations (transcripts + audio)
| Method | Endpoint | VOLA function |
|---|---|---|
| GET | `/v1/convai/conversations/{conversationId}` | `getConversation()` + proxy route |
| GET | `/v1/convai/conversations/{conversationId}/audio` | proxy route (streams `audio/mpeg`) |

### Speech-to-Text (human-transfer recordings only)
| Method | Endpoint | VOLA file |
|---|---|---|
| POST | `/v1/speech-to-text` | `lib/elevenlabs-transcription.ts` — multipart: `file`, `model_id:scribe_v2`, `diarize:true`, `timestamps_granularity:word` |

---

## 3. Feature Areas (with data flow)

### A. Agent Lifecycle (create / update / delete)
**Core**: `createElevenLabsAgent` / `updateElevenLabsAgent` / `deleteElevenLabsAgent` in `lib/elevenlabs.ts`.

An agent is created per campaign (and per global/Sloty/Servy agent). The **`conversation_config`** is the central object a replacement must reproduce:

```jsonc
{
  "agent": {
    "prompt": {
      "prompt": "<systemPrompt + KB + task/appointment/inventory instructions>",
      "llm": "qwen36-35b-a3b",            // EL's own LLM bypassed
      "tools": [ /* system + webhook tools, see B */ ],
      "knowledge_base": [ { "id": "<ragDocId>", "usage_mode": "auto" } ],
      "rag": { "enabled": true, "embedding_model": "e5_mistral_7b_instruct" }
    },
    "first_message": "<dynamic, uses {{variables}}>",
    "disable_first_message_interruptions": false,
    "language": "en"
  },
  "tts": {
    "voice_id": "<voice>",
    "model_id": "eleven_turbo_v2 | eleven_v3_conversational",
    "supported_voices": [...],
    "text_normalisation_type": "elevenlabs",
    "agent_output_audio_format": "ulaw_8000"
  },
  "asr": {
    "quality": "high",
    "provider": "scribe_realtime",
    "user_input_audio_format": "ulaw_8000",
    "keywords": [...]
  },
  "conversation": { "max_duration_seconds": 300 },
  "turn": { "turn_eagerness": "normal", "speculative_turn": false, "turn_model": "turn_v2" },
  "backup_llm_config": { "preference": "override" },
  "language_presets": { /* code -> {overrides:{}} for auto language switch */ }
}
```

The prompt is assembled server-side: `systemPrompt` + injected `Knowledge Base:` + always-on `TASK_AWARENESS_INSTRUCTIONS` + optional appointment/inventory instruction blocks.

**Create callers**: `campaigns/route.ts`, `campaigns/[id]/start-campaign`, `campaigns/[id]/duplicate`, `v1/campaigns`, `admin/clients/[id]/global-agent/create`, `lib/sloty/service.ts`, `lib/servy/service-reminder-campaign.ts`.
**Update callers**: `campaigns/[id]/route.ts`, `account/global-agent`, `account/sloty-agent`, `account/appointment-config`, `admin/settings/sloty-base-prompt`, `lib/agent-merge-utils.ts`, `lib/aiwy/project-kb-sync.ts`, `lib/rag-service.ts`.

### B. Agent Tools (function calling during a call)
Built inside agent create/update in `lib/elevenlabs.ts`.

**System tools:** `end_call`, `language_detection`, `voicemail_detection`, `transfer_to_number`.

**`transfer_to_number`** (transfer to human): `transfers[{ transfer_type:"conference", destination_type:"phone_number", phone_number(E.164), condition }]`. Config columns: `enableCallTransferTool`, `callTransferPhoneNumber`, `callTransferDescription`, `callTransferCondition`. (Note: EL doesn't record the human side of the call — that's captured separately via FreJun, see §F.)

**Webhook tools (appointments):** `check_appointment_availability`, `book_appointment`, `reschedule_appointment`, `cancel_appointment` → POST to `${baseUrl}/api/vola-appointments/ai-tools?action=...` with `Authorization: Bearer $ELEVENLABS_WEBHOOK_SECRET`.
**Webhook tool (inventory):** `search_inventory` → `${baseUrl}/api/inventory/ai-tools`.
**Sloty/Calendly tools** (`lib/sloty/tool-sync.ts`): 5 standalone tools registered via Tools API, attached to agent via `prompt.tool_ids`, pointing at `/api/sloty/tools/calendly/{clientId}/...`.

> Tool URLs are **absolute and injected at agent-create time**. Any provider swap must re-register tools with correct public URLs + auth headers.

### C. Batch Calling & Scheduling
- Recipient construction: `lib/batch-scheduler.ts` — each recipient `{ phone_number, conversation_initiation_client_data.dynamic_variables }`; `scheduled_time_unix` for future scheduling.
- **Dynamic variables**: `lib/dynamic-variables.ts` `buildDynamicVariables()` builds a map (contact name/company/location/about, client company/phone/address, campaign name/agent_name, custom vars, `next_retry_time`) injected into first message / prompt / KB.
- Batch creators: `sequential-scheduler.ts`, `servy/servy-retry-service.ts`, `campaigns/[id]/batch-call`, `contacts/[contactId]/recall`, `contacts/reschedule`, `public/global-agent/.../submit`, `tasks/[taskId]/actions/reschedule`.
- Status sync (polling when webhooks miss): `batch-call-info`, `batches/[batchId]`, `contacts/sync-stale`.
- Cancel: `batches/[batchId]/cancel`, `contacts/[contactId]`, `contacts/reschedule`, `contacts/[contactId]/recall`.

### D. Phone / Twilio / SIP
Both `twilio` and `sip_trunk` providers supported (`CreatePhoneNumberTwilioParams` / `CreatePhoneNumberSipParams`). SIP config includes `inbound_trunk_config` / `outbound_trunk_config` (credentials, media_encryption, allowed_addresses/numbers, remote_domains, transport, headers). Agent↔phone assignment via PATCH is how inbound calls route to global agents.
Route handlers: `admin/phone-numbers/*`, `admin/clients/[id]/phone-numbers/*`, `admin/settings/global-phone`, `admin/phone-numbers/test-call`.

### E. Webhooks (inbound events from ElevenLabs)
**Handler**: `app/api/webhooks/elevenlabs/route.ts` (~4,135 lines).

**Signature verification** (`verifySignature()`): header `elevenlabs-signature` = `t=<ts>,v0=<hash>`; HMAC-SHA256 over `` `${timestamp}.${rawBody}` `` with `ELEVENLABS_WEBHOOK_SECRET`; 30-min window; `crypto.timingSafeEqual`.

**Events handled**: `conversation.call.started`, `conversation.call.ended`, `conversation.call.failed`, `call_initiation_failure`, `post_call_transcription`. Each has **two parallel code paths** — campaign agent vs global agent (`checkIsGlobalAgentCall(agentId)`).

**Payload fields consumed**: `type`, `agent_id`, `call_id`, `phone_number`, `conversation_id`, `error`; `analysis{ call_successful, summary, lead_score, transcript_summary, call_summary_title }`; `recording_url`; `transcript[]{role,message,time_in_call_secs,timestamp}`; `duration`, `started_at`, `ended_at`; `metadata.{ call_duration_secs, start_time_unix_secs }`, `metadata.phone_call.{ call_sid, external_number }`. `call_initiation_failure` parses both Twilio (`body.Called/CallSid/CallStatus`) and SIP (`body.to_number/from_number/call_sid/sip_status_code/error_reason`) formats.

**What the webhook writes**: contact status transitions (with stale-event guarding via `activeCallId`/`activeConversationId`), `conversations` + `conversationMessages` rows, credit deduction, retry scheduling, scheduler slot release, batch completion, CRM push, client webhook fan-out.

### F. Lead Scoring / Analysis / Summaries
- **Summaries & basic `lead_score` come from ElevenLabs** `analysis.*`.
- **Deeper lead scoring uses OpenAI** (`lib/lead-scoring.ts`, `@ai-sdk/openai`) over the EL transcript — categories hot/warm/cold/others. Called in webhook + `contacts/recalculate-lead-scores`.
- **Task extraction** (`lib/task-extraction.ts`) is also OpenAI-based over the transcript.

### G. Transcripts & Audio Retrieval (UI)
Proxy routes `app/api/elevenlabs/conversations/[conversationId]/route.ts` (transcript/details) and `.../audio/route.ts` (mp3 stream). Consumed by call-detail dialogs and conversation-transcript UIs.

### H. Stuck-Detection / Reconciliation
`lib/stuck-detection-service.ts` and `contacts/sync-stale` call `getConversation()` to reconcile state when webhooks don't fire.

### I. RAG / Knowledge Base
`lib/rag-service.ts` orchestrates: create-doc → trigger-index → poll-status → attach-to-agent → detach. Default KB text is *also* injected into the prompt; RAG is a separate retrievable `knowledge_base[]` doc (`usage_mode:"auto"`), gated by `rag.enabled` + matching `embedding_model`.

### J. V3 Voice / TTS
`lib/eleven-v3-utils.ts` + `lib/eleven-v3-constants.ts` (audio tags, V3 voice IDs, 70+ languages). Toggled client-level (`clients.elevenV3Enabled`) or system-level (`systemSettings key=eleven_v3_enabled`). Admin UI: `admin/settings/eleven-v3`, `admin/settings/voices-form.tsx`.

---

## 4. Data Model Fields Tied to ElevenLabs
(`lib/db/schema.ts`)

- **voices**: `elevenLabsVoiceId`, `gender`, `expressionSupported`, `isActive`
- **campaigns**: `agentId` (EL agent id), `batchCallId`, `voiceId`, `phoneNumberId`, `elevenLabsKbDocId` (RAG doc), `ragStatus`, `useRag`, tool-config columns, index `idx_campaigns_agent_id`
- **batchCalls**: `batchCallId` (EL external id), `scheduledTimeUnix`, `batchNumber`, `status`, `totalContacts`
- **contacts**: `batchCallId`, `leadScore`, `metadata.{ activeCallId, activeConversationId, activeCallStartedAt, callId, conversationId, failureReason, lastProcessedConversationId, creditsCharged }`
- **conversations**: `callId` (Twilio/call SID, unique), `conversationId` (EL id), `audioUrl`, `summary`, `leadScore`, `duration`, `totalMessages`
- **clients**: `globalAgentId`, `slotyAgentId`, `elevenV3Enabled`, `globalAgentLeadScorePrompt`, `phoneNumberId`

---

## 5. Fish Audio Replacement — POC Checklist / Gotchas

1. **Confirm scope.** ElevenLabs here = ASR + TTS + turn-taking + telephony (Twilio/SIP) + batch dispatch + webhooks + conversation/RAG/tool orchestration. If Fish Audio is **TTS-only**, it replaces only the `tts.voice_id`/`model_id` slice — you'll still need a conversation/telephony platform for the rest.
2. **LLM is already external** (`qwen36-35b-a3b`), and lead scoring/task extraction are OpenAI. So the "AI brain" is *not* an ElevenLabs dependency — good, that decouples cleanly.
3. **`ELEVENLABS_WEBHOOK_SECRET` is dual-purpose** — verifies inbound webhooks AND is the Bearer token the agent sends to VOLA's own tool endpoints. A replacement must preserve both directions.
4. **Global-agent vs campaign-agent** are two distinct webhook code paths — both must be replicated.
5. **STT (`scribe_v2`)** is a separate surface used only for FreJun human-transfer diarization — independent of the live call transcript.
6. **Webhook-tool URLs are absolute and injected at agent-create time** — a swap must re-register tools with correct public URLs + auth headers.
7. **Audio format**: calls run at `ulaw_8000` (telephony μ-law 8kHz) end-to-end — verify Fish Audio can produce/accept this for real-time telephony, not just high-fidelity file TTS.
8. **Turn-taking / interruption / voicemail detection** are handled by ElevenLabs' orchestration (`turn_model`, system tools) — a TTS-only provider does not cover these.
9. **Two cancel path spellings** (`batch-calling` vs `batch_calling`) exist in the codebase — normalize if refactoring.

---

## 6. Key Files Reference

| File | Role |
|---|---|
| `lib/elevenlabs.ts` | Central integration (agents, batch, phone, conversations, KB) |
| `lib/elevenlabs-transcription.ts` | Speech-to-text (human-transfer recordings) |
| `lib/eleven-v3-utils.ts` / `lib/eleven-v3-constants.ts` | V3 voice/TTS config |
| `lib/dynamic-variables.ts` | Per-recipient dynamic variables |
| `lib/batch-scheduler.ts` / `lib/sequential-scheduler.ts` | Batch/recipient construction & scheduling |
| `lib/rag-service.ts` | KB/RAG orchestration |
| `lib/sloty/tool-sync.ts` | Standalone appointment tools |
| `lib/lead-scoring.ts` / `lib/task-extraction.ts` | OpenAI post-call analysis over EL transcripts |
| `app/api/webhooks/elevenlabs/route.ts` | Inbound webhook handler (signed) |
| `app/api/elevenlabs/conversations/[conversationId]/route.ts` (+ `/audio`) | Transcript & audio proxy |
| `app/api/vola-appointments/ai-tools/route.ts`, `app/api/inventory/ai-tools/route.ts` | Agent webhook-tool endpoints |
| `app/api/admin/phone-numbers/*` | Phone number management (Twilio/SIP) |
| `scripts/update-agent-models.ts` | Bulk agent LLM/model migration |
