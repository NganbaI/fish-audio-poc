// Normalise a Fish session into the fields our UI shows. Used by the webhook
// (call.analyzed hydration) and the on-demand /api/calls/[id]/sync route.
//
// Fish's exact session shape isn't fully documented, so parsing is defensive and
// we also keep the raw payload. Verify against https://api.fish.audio/openapi.json.

import { getSession, getRecording } from "@/lib/fish";
import type {
  CallAnalysis,
  StoredToolCall,
  StoredTranscriptItem,
} from "@/lib/types";

export interface NormalizedSession {
  status?: string;
  endedReason?: string;
  language?: string;
  summary?: string;
  analysis?: CallAnalysis;
  transcript?: StoredTranscriptItem[];
  toolCalls?: StoredToolCall[];
  recordingUrls?: string[];
  durationSeconds?: number;
  startedAt?: string;
  endedAt?: string;
  raw: Record<string, unknown>;
  hydrated: boolean;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseTranscript(items: unknown[]): StoredTranscriptItem[] {
  return items
    .map((it): StoredTranscriptItem | null => {
      const o = it as Record<string, unknown>;
      const type = o.type as string | undefined;
      if (type && type !== "message") return null; // skip tool_call/tool_result here
      const role = (o.role ?? o.speaker) as string | undefined;
      const text = (o.text ?? o.message ?? o.content) as string | undefined;
      if (!role || typeof text !== "string") return null;
      const seconds = o.time_in_call_secs ?? o.start ?? o.seconds;
      return {
        role,
        text,
        seconds: typeof seconds === "number" ? seconds : undefined,
      };
    })
    .filter((x): x is StoredTranscriptItem => x !== null);
}

function parseToolCalls(items: unknown[]): StoredToolCall[] {
  return items
    .map((it): StoredToolCall | null => {
      const o = it as Record<string, unknown>;
      const type = o.type as string | undefined;
      const name = (o.tool_name ?? o.toolName ?? o.name) as string | undefined;
      if (!name) return null;
      if (type && !String(type).includes("tool")) return null;
      return {
        name,
        source: str(o.tool_source ?? o.source),
        input: str(o.input),
        output: str(o.output),
        error: str(o.error),
      };
    })
    .filter((x): x is StoredToolCall => x !== null);
}

export async function normalizeSession(
  sessionId: string,
): Promise<NormalizedSession> {
  const out: NormalizedSession = { raw: {}, hydrated: false };

  try {
    const session = await getSession(sessionId);
    out.raw = session;
    out.status = str(session.status);
    out.endedReason = str(session.ended_reason ?? session.end_reason);
    out.language = str(session.language ?? session.language_code);
    out.startedAt = str(session.started_at ?? session.created_at);
    out.endedAt = str(session.ended_at);
    if (typeof session.duration_seconds === "number") {
      out.durationSeconds = session.duration_seconds;
    }

    const items = (session.items ?? session.timeline ?? session.messages) as
      | unknown[]
      | undefined;
    if (Array.isArray(items)) {
      const transcript = parseTranscript(items);
      const toolCalls = parseToolCalls(items);
      if (transcript.length) out.transcript = transcript;
      if (toolCalls.length) out.toolCalls = toolCalls;
    }

    // Analysis may be embedded in the session detail.
    const analysis = session.analysis as CallAnalysis | undefined;
    if (analysis && typeof analysis === "object") {
      out.analysis = analysis;
      if (typeof analysis.summary === "string") out.summary = analysis.summary;
    }
  } catch (err) {
    console.error(`[normalizeSession] getSession(${sessionId}) failed:`, err);
  }

  try {
    const rec = await getRecording(sessionId);
    const tracks = (rec.tracks ?? rec.recordings ?? rec.urls) as
      | unknown[]
      | undefined;
    if (Array.isArray(tracks)) {
      out.recordingUrls = tracks
        .map((t) => {
          if (typeof t === "string") return t;
          const o = t as Record<string, unknown>;
          return str(o.url ?? o.signed_url);
        })
        .filter((u): u is string => typeof u === "string");
    } else if (typeof rec.url === "string") {
      out.recordingUrls = [rec.url];
    }
  } catch (err) {
    console.error(`[normalizeSession] getRecording(${sessionId}) failed:`, err);
  }

  out.hydrated = Boolean(out.transcript || out.recordingUrls || out.analysis);
  return out;
}
