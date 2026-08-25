# Fish Audio — Capabilities & API Reference

> A consolidated reference of everything Fish Audio can do and every API you can call.
> Source: <https://docs.fish.audio/overview/capabilities> and the linked docs (fetched 2026-08-25).
>
> **Base URL:** `https://api.fish.audio`
> **Auth:** `Authorization: Bearer <FISH_API_KEY>` on every request. Get keys at <https://fish.audio/app/api-keys/>
> **Machine-readable specs:** OpenAPI `https://docs.fish.audio/api-reference/openapi.json` · AsyncAPI (WebSocket) `https://docs.fish.audio/api-reference/asyncapi.yml` · Full doc index `https://docs.fish.audio/llms.txt`

---

## 1. What Fish Audio Can Do

### Core (API-accessible) features
| Feature | Description |
|---------|-------------|
| **Text to Speech (TTS)** | Convert text into lifelike speech across multiple models and 30+ languages. Streaming supported. |
| **Speech to Text (STT/ASR)** | Transcribe audio to text with per-segment timestamps and automatic language detection. |
| **Voice Cloning** | Instantly clone voices from short clips (zero-shot) or train persistent custom voice models. |
| **Voice Design** | Generate brand-new candidate voices from a natural-language prompt. |
| **Realtime Streaming** | Stream audio as it is generated (WebSocket) for voice agents and live apps. |
| **Manage Voices** | List, inspect, update, and delete voice models via the Model API. |
| **Voice Agents** | Full platform for building, deploying, and monitoring conversational voice agents (incl. telephony). |

### Browser-based / web-app features (no code required)
| Feature | Description |
|---------|-------------|
| **Voice Changer** | Transform existing audio into a different voice. |
| **Story Studio** | Produce multi-speaker, long-form audio for audiobooks and narration. |
| **Music & Sound Effects** | Generate music and cinematic sound effects from prompts. |
| **Audio Separation** | Split audio into stems and other processing utilities. |

### Ways to access
1. **Web app** — <https://fish.audio> (no code)
2. **REST API** — `https://api.fish.audio`
3. **Official SDKs** — Python & JavaScript
4. **AI coding agents** — installable Fish Audio skill

---

## 2. Models

### TTS models
| Model | Notes |
|-------|-------|
| `s2.1-pro` | **Recommended** production model (default). |
| `s2.1-pro-free` | Free tier for testing/development (no charge). |
| `s2-pro` | Previous generation, multi-speaker support. |
| `s1` | Legacy model with emotion tags. No multi-speaker. |

- **Multi-speaker** is available on the S2 family only (`s2-pro`, `s2.1-pro`, `s2.1-pro-free`) via `<|speaker:0|>`, `<|speaker:1|>` tags in text, plus an array of `reference_id`s.

### Other models
| Model | Used by |
|-------|---------|
| `transcribe-1` | Speech to Text (ASR) |
| `voice-design-1` | Voice Design |

Docs: Models overview `/developer-guide/models-pricing/models-overview` · Choosing a model `/developer-guide/models-pricing/choosing-a-model` · Deprecations `/developer-guide/models-pricing/deprecations`

---

## 3. REST API Endpoints

### 3.1 Text to Speech — `POST /v1/tts`
Convert text to speech. Streams audio back via chunked transfer encoding.

- **Content-Type:** `application/json` or `application/msgpack` (msgpack required for inline reference audio).
- **`model` header:** `s2.1-pro` (default), `s2.1-pro-free`, `s2-pro`, `s1`.

**Key body parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | **required** | Text to synthesize. |
| `reference_id` | string / array | null | Voice model ID(s). |
| `references` | array | null | Inline audio samples for zero-shot cloning. |
| `temperature` | number (0–1) | 0.7 | Expressiveness. |
| `top_p` | number (0–1) | 0.7 | Nucleus sampling diversity. |
| `prosody` | object | null | `{ speed (0.5–2.0), volume (dB), normalize_loudness }`. |
| `chunk_length` | int (100–300) | 300 | Text segment size. |
| `min_chunk_length` | int (0–100) | 50 | Min chars before split. |
| `normalize` | bool | true | Text normalization. |
| `format` | string | `mp3` | `mp3`, `wav`/`pcm`, `opus`. |
| `sample_rate` | int | null | Hz (default per format). |
| `mp3_bitrate` | int | 128 | 64 / 128 / 192 kbps. |
| `opus_bitrate` | int | -1000 | auto / 24 / 32 / 48 / 64 kbps. |
| `latency` | string | `normal` | `low` / `balanced` / `normal`. |
| `max_new_tokens` | int | 1024 | Max audio tokens per chunk. |
| `repetition_penalty` | number | 1.2 | Repeat-pattern penalty. |
| `condition_on_previous_chunks` | bool | true | Cross-chunk consistency. |
| `early_stop_threshold` | number (0–1) | 1 | Early stop. |
| `features` | array | [] | Feature flags, e.g. `"quality-guard"`. |

**Audio format support:** WAV/PCM (8/16/24/32/44.1 kHz, 16-bit mono) · MP3 (32/44.1 kHz mono, 64/128/192 kbps) · Opus (48 kHz mono, auto/24/32/48/64 kbps).

**Responses:** 200 streaming audio · 401 auth · 402 payment/quota · 503 overload.

### 3.2 Speech to Text — `POST /v1/asr`
Transcribe audio to text (model `transcribe-1`).

- **Content-Type:** `multipart/form-data` or `application/msgpack`. (JSON with base64 audio is **not** supported.)
- **Params:** `audio` (binary, required) · `language` (optional hint) · `ignore_timestamps` (default true).
- **Response:** `text`, `duration`, `segments[]` (`text`, `start`, `end`), `language_code` (ISO 639-1), `language`.

### 3.3 Voice Design — `POST /v1/voice-design`
Generate candidate voices from a natural-language prompt (model header `voice-design-1`).

- **Content-Type:** `application/json`.
- **Params:** `instruction` (string 1–2000, required) · `reference_text` (≤150) · `language` (BCP-47) · `n` (1–4, default 2) · `speed` (0<x≤3, default 1) · `num_step` (1–128, default 32) · `guidance_scale` (default 2) · `instruct_guidance_scale` (default 0) · `seed`.
- **Response:** `candidates[]` each with `id`, `index`, `audio_base64`, `sample_rate`, `duration_ms`, optional `text`/`instruct`/`language`.

### 3.4 Model (Voice) Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/model` | POST | Create a custom voice model. |
| `/model` | GET | List available models. |
| `/model/{id}` | GET | Get model details. |
| `/model/{id}` | PATCH/PUT | Update a model. |
| `/model/{id}` | DELETE | Delete a model. |

**Create Model** (`POST /model`, `multipart/form-data`):
- Required: `type` (`tts`), `title`, `train_mode` (`fast`), `voices` (1–20 audio files).
- Optional: `visibility` (`public`/`unlist`/`private`) · `description` · `cover_image` (required for public) · `texts` (transcriptions; auto ASR if omitted) · `tags` · `enhance_audio_quality` (default true) · `generate_sample` (default false).
- **Response 201:** model metadata incl. `_id`, `state` (`created`/`training`/`trained`/`failed`), timestamps, visibility, author.

### 3.5 WebSocket TTS Streaming — `wss://api.fish.audio/v1/tts/live`
Real-time TTS. MessagePack serialization, bidirectional event protocol. Optional `model` header (default `s2.1-pro`).

- **Client → Server:** `StartEvent` (first; carries a `request` object = HTTP TTS params) → `TextEvent` (`{event:"text", text:"..."}`, repeatable) → optional `FlushEvent` (`{event:"flush"}`) → `CloseEvent` (`{event:"stop"}`, last).
- **Server → Client:** `AudioEvent` (`{event:"audio", audio:<binary>}`, repeatable) → `FinishEvent` (`{event:"finish", reason:"stop"|"error"}`).

---

## 4. SDKs

### Python SDK
- Overview `/developer-guide/sdk-guide/python/overview`
- Authentication `/developer-guide/sdk-guide/python/authentication`
- Text-to-Speech `/developer-guide/sdk-guide/python/text-to-speech`
- Voice Cloning `/developer-guide/sdk-guide/python/voice-cloning`
- WebSocket Streaming `/developer-guide/sdk-guide/python/websocket`

### JavaScript SDK
- Installation `/developer-guide/sdk-guide/javascript/installation`
- Authentication `/developer-guide/sdk-guide/javascript/authentication`
- Text-to-Speech `/developer-guide/sdk-guide/javascript/text-to-speech`
- Voice Cloning `/developer-guide/sdk-guide/javascript/voice-cloning`
- WebSocket `/developer-guide/sdk-guide/javascript/websocket`

---

## 5. Advanced Speech Control

| Capability | Docs path |
|------------|-----------|
| Emotion Control (emotion tags) | `/developer-guide/core-features/emotions` |
| Fine-grained Control | `/developer-guide/core-features/fine-grained-control` |
| English Phoneme Control (CMU Arpabet) | `/developer-guide/core-features/fine-grained-control/english` |
| Chinese Phoneme Control (tone-number pinyin) | `/developer-guide/core-features/fine-grained-control/chinese` |
| Japanese Phoneme Control (romaji + pitch accent) | `/developer-guide/core-features/fine-grained-control/japanese` |
| Voice Cloning Best Practices | `/developer-guide/best-practices/voice-cloning` |
| Real-time Voice Streaming | `/developer-guide/best-practices/real-time-streaming` |

---

## 6. Voice Agents Platform

A full platform for building conversational voice agents.

- **Build:** Overview, Quickstart, Concepts (workspaces/versions/sessions), Configuration, Voice & Language, Time & Timezone, Knowledge Base, Tools (Webhook / Client / System), Dynamic Variables, Custom LLM.
- **Deploy:** Versions & Publishing, Deployment Overview, Authentication & Session Tokens, Public Agents, **Web SDK** (`@fishaudio/agent-client`), **React SDK**, Widget (embeddable), Wire Protocol.
- **Telephony:** Phone Numbers, Inbound Calls, Call Transfers.
- **Test:** Preview Calls, Agent Tests (scripted, LLM judge).
- **Monitor:** Conversation History (API), Post-call Analysis (summaries + data extraction), Agent Webhooks (HMAC-verified events).

Root: `/agents/overview`

---

## 7. Pricing & Rate Limits

### Pricing
| Service | Model | Price |
|---------|-------|-------|
| TTS | `s2.1-pro`, `s2-pro`, `s1` | **$15.00 / million UTF-8 bytes** (≈180k English words ≈ 12h audio) |
| TTS | `s2.1-pro-free` | Free |
| STT | `transcribe-1` | **$0.36 / audio hour** (rounded up to nearest second) |
| Voice Design | `voice-design-1` | **$0.01 / successful request** (charged once even for multiple candidates; errors free) |

### Concurrency tiers (scale with spend)
| Tier | Threshold | Concurrent requests |
|------|-----------|---------------------|
| Starter | < $100 | 5 |
| Elevated | ≥ $100 | 15 |
| High Volume | ≥ $1,000 | 50 |
| Enterprise | Custom | Custom |

Tiers unlock immediately at prepaid thresholds. Effective QPS/QPM depends on per-request duration.

Docs: `/developer-guide/models-pricing/pricing-and-rate-limits`

---

## 8. Other Useful Docs
- Quick Start: `/developer-guide/getting-started/quickstart`
- API Introduction: `/api-reference/introduction`
- Errors: `/api-reference/errors`
- Tracing & Performance / Observability: `/api-reference/observability`
- Migration Guide (from other TTS providers): `/developer-guide/resources/migration`
- Changelog: `/developer-guide/getting-started/changelog`
- AI Coding Assistants setup: `/developer-guide/resources/coding-agents`

---

## 9. Quick Examples

**TTS (curl):**
```bash
curl https://api.fish.audio/v1/tts \
  -H "Authorization: Bearer $FISH_API_KEY" \
  -H "Content-Type: application/json" \
  -H "model: s2.1-pro" \
  -d '{"text":"Hello from Fish Audio","format":"mp3","reference_id":"<VOICE_MODEL_ID>"}' \
  --output out.mp3
```

**STT (curl):**
```bash
curl https://api.fish.audio/v1/asr \
  -H "Authorization: Bearer $FISH_API_KEY" \
  -F "audio=@sample.wav" \
  -F "language=en"
```

**Voice Design (curl):**
```bash
curl https://api.fish.audio/v1/voice-design \
  -H "Authorization: Bearer $FISH_API_KEY" \
  -H "Content-Type: application/json" \
  -H "model: voice-design-1" \
  -d '{"instruction":"A warm, calm female narrator in her 30s","n":2}'
```
