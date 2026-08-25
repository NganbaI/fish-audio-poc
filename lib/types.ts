// Shared types for the Fish Audio POC.
// The agent-management + session-read shapes below follow the Fish Audio docs
// (https://docs.fish.audio/agents). The session *creation* request/response and
// all realtime types are re-exported from the official @fishaudio/agent-protocol
// SDK, so those are exact. Server REST shapes not covered by the SDK are typed
// loosely on purpose — verify against https://api.fish.audio/openapi.json.

export type AnalysisFieldType = "boolean" | "number" | "text" | "enum";

export interface AnalysisDataField {
  name: string;
  type: AnalysisFieldType;
  description: string;
  /** Only for type: "enum". */
  options?: string[];
}

export interface AnalysisCriterion {
  name: string;
  description: string;
}

/** Partial agent config we PATCH onto an agent (deep-merged server-side). */
export interface AgentConfig {
  prompt?: {
    system_prompt?: string;
    first_message?: string;
  };
  voice?: {
    voice_id?: string;
    speaking_language?: string;
  };
  conversation?: {
    eagerness?: "relaxed" | "balanced" | "eager";
    interruptible?: boolean;
    interruption_sensitivity?: "low" | "balanced" | "high";
    record_audio?: boolean;
    max_duration_seconds?: number;
  };
  analysis?: {
    summary?: { enabled: boolean; language?: string };
    data_fields?: AnalysisDataField[];
    criteria?: AnalysisCriterion[];
  };
}

/** Result of extracted post-call analysis, as stored by our webhook. */
export interface CallAnalysis {
  summary?: string;
  data_fields?: Record<string, string | number | boolean | null>;
  criteria?: Record<string, "success" | "failure" | "unknown">;
  [k: string]: unknown;
}

/** One transcript line in a stored call record. */
export interface StoredTranscriptItem {
  role: "user" | "agent" | string;
  text: string;
  seconds?: number;
}

/** A tool the agent invoked during the call (client/webhook/system). */
export interface StoredToolCall {
  name: string;
  source?: string;
  input?: string;
  output?: string;
  error?: string;
}

/** A call/session record persisted by the webhook + hydration step. */
export interface CallRecord {
  id: string; // session_id
  agentId?: string;
  status: "created" | "in_progress" | "ended" | "analyzed" | string;
  endedReason?: string;
  source?: "web" | "phone" | string;
  language?: string;
  summary?: string;
  analysis?: CallAnalysis;
  transcript?: StoredTranscriptItem[];
  toolCalls?: StoredToolCall[];
  recordingUrls?: string[];
  durationSeconds?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Full raw Fish session payload, for the "everything else" view. */
  raw?: unknown;
  /** True once transcript + recording were hydrated via the read API. */
  hydrated?: boolean;
}
