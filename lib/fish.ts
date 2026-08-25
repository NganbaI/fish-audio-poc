// Central Fish Audio server-side client — the POC analogue of VOLA's lib/elevenlabs.ts.
// All calls send `Authorization: Bearer $FISH_API_KEY`. Keep this the ONLY place
// that talks to the Fish REST API so a path/shape fix lands in one file.
//
// Session-creation types come from the official SDK (exact). Agent-management and
// session-read paths follow the docs; confirm against https://api.fish.audio/openapi.json.

import type {
  AgentSessionCreateRequest,
  SessionToken,
} from "@fishaudio/agent-protocol";
import type { AgentConfig } from "@/lib/types";

const BASE = process.env.FISH_API_BASE ?? "https://api.fish.audio";

function apiKey(): string {
  const key = process.env.FISH_API_KEY;
  if (!key) {
    throw new Error(
      "FISH_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return key;
}

interface FishFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Extra headers, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
}

/** Thin JSON fetch wrapper with auth + useful error messages. */
export async function fishFetch<T = unknown>(
  path: string,
  { method = "GET", body, headers }: FishFetchOptions = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Never cache control-plane calls.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Fish API ${method} ${path} failed: ${res.status} ${res.statusText}${
        text ? ` — ${text}` : ""
      }`,
    );
  }

  // Some endpoints (e.g. DELETE) may return empty bodies.
  const raw = await res.text();
  return (raw ? JSON.parse(raw) : undefined) as T;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export interface CreatedAgent {
  id: string;
  [k: string]: unknown;
}

/** Create a draft agent. Returns the new agent (with its id). */
export async function createAgent(name: string): Promise<CreatedAgent> {
  const data = await fishFetch<Record<string, unknown>>("/v1/agent/agents", {
    method: "POST",
    body: { name },
  });
  const id = (data.id ?? data._id ?? data.agent_id) as string | undefined;
  if (!id) {
    throw new Error(
      `createAgent: could not find agent id in response: ${JSON.stringify(data)}`,
    );
  }
  return { ...data, id };
}

/** Deep-merge config onto an agent's draft (prompt/voice/conversation/analysis). */
export function updateAgentConfig(
  agentId: string,
  config: AgentConfig,
): Promise<unknown> {
  return fishFetch(`/v1/agent/agents/${agentId}/config`, {
    method: "PATCH",
    body: config,
  });
}

/** Publish the current draft. Sessions/calls run the latest published version. */
export function publishAgent(agentId: string): Promise<unknown> {
  return fishFetch(`/v1/agent/agents/${agentId}/publish`, { method: "POST" });
}

export function getAgent(agentId: string): Promise<unknown> {
  return fishFetch(`/v1/agent/agents/${agentId}`);
}

/** List all agents the API key can access. Shape varies; return raw. */
export function listAgents(): Promise<Record<string, unknown>> {
  return fishFetch(`/v1/agent/agents`);
}

/** Fetch an agent's draft configuration (prompt/voice/conversation/analysis). */
export function getAgentConfig(
  agentId: string,
): Promise<Record<string, unknown>> {
  return fishFetch(`/v1/agent/agents/${agentId}/config`);
}

// ---------------------------------------------------------------------------
// Voices (Models API — voice_id == TTS reference_id)
// ---------------------------------------------------------------------------

export interface FishVoice {
  id: string;
  title: string;
  languages?: string[];
}

/**
 * List voice models usable as an agent voice_id. The Models API returns a
 * paginated list; we normalise to {id, title, languages}. Best-effort parsing.
 */
export async function listVoices(): Promise<FishVoice[]> {
  const data = await fishFetch<Record<string, unknown>>(
    `/v1/model?page_size=100`,
  );
  const items = (data.items ?? data.data ?? data.models) as unknown[] | undefined;
  if (!Array.isArray(items)) return [];
  return items
    .map((it): FishVoice | null => {
      const o = it as Record<string, unknown>;
      const id = (o._id ?? o.id) as string | undefined;
      if (!id) return null;
      return {
        id,
        title: (o.title as string) ?? (o.name as string) ?? id,
        languages: Array.isArray(o.languages)
          ? (o.languages as string[])
          : undefined,
      };
    })
    .filter((v): v is FishVoice => v !== null);
}

// ---------------------------------------------------------------------------
// Sessions (create token + read history)
// ---------------------------------------------------------------------------

/**
 * Mint a single-use session token (LiveKit transport) for a browser client.
 * Returns the SessionToken verbatim — pass it to the web SDK's startSession.
 */
export function createSession(
  req: AgentSessionCreateRequest,
): Promise<SessionToken> {
  return fishFetch<SessionToken>("/v1/agent/sessions", {
    method: "POST",
    body: req,
  });
}

/** Full session detail: merged timeline (message / tool_call / tool_result) + analysis. */
export function getSession(sessionId: string): Promise<Record<string, unknown>> {
  return fishFetch(`/v1/agent/sessions/${sessionId}`);
}

/** Signed recording URLs — one audio track per speaker. */
export function getRecording(
  sessionId: string,
): Promise<Record<string, unknown>> {
  return fishFetch(`/v1/agent/sessions/${sessionId}/recording`);
}

export interface ListSessionsParams {
  agent_id?: string;
  status?: string;
  caller_number?: string;
  limit?: number;
}

export function listSessions(
  params: ListSessionsParams = {},
): Promise<Record<string, unknown>> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, String(v));
  }
  const qs = q.toString();
  return fishFetch(`/v1/agent/sessions${qs ? `?${qs}` : ""}`);
}
