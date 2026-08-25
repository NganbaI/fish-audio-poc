// Supabase-backed call records. User reads use the RLS-scoped server client;
// webhook writes use the service-role admin client (bypasses RLS) and must set
// owner_user_id explicitly.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallRecord } from "@/lib/types";

/** DB row (snake_case) → app CallRecord (camelCase). */
function fromRow(row: Record<string, unknown>): CallRecord {
  return {
    id: row.session_id as string,
    agentId: (row.fish_agent_id as string) ?? undefined,
    status: (row.status as string) ?? "created",
    endedReason: (row.ended_reason as string) ?? undefined,
    source: (row.source as string) ?? undefined,
    summary: (row.summary as string) ?? undefined,
    analysis: (row.analysis as CallRecord["analysis"]) ?? undefined,
    transcript: (row.transcript as CallRecord["transcript"]) ?? undefined,
    recordingUrls: (row.recording_urls as string[]) ?? undefined,
    durationSeconds: (row.duration_seconds as number) ?? undefined,
    startedAt: (row.started_at as string) ?? undefined,
    endedAt: (row.ended_at as string) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date(0).toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date(0).toISOString(),
    hydrated: (row.hydrated as boolean) ?? undefined,
  };
}

export async function listCallsForUser(
  supabase: SupabaseClient,
): Promise<CallRecord[]> {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCallsForUser: ${error.message}`);
  return (data ?? []).map(fromRow);
}

export async function getCallForUser(
  supabase: SupabaseClient,
  id: string,
): Promise<CallRecord | null> {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("session_id", id)
    .maybeSingle();
  if (error) throw new Error(`getCallForUser: ${error.message}`);
  return data ? fromRow(data) : null;
}

/** Row shape for a call upsert (webhook / session seed). snake_case columns. */
export interface CallUpsert {
  session_id: string;
  fish_agent_id?: string;
  agent_id?: string | null;
  owner_user_id?: string | null;
  status?: string;
  ended_reason?: string;
  source?: string;
  summary?: string;
  analysis?: unknown;
  transcript?: unknown;
  recording_urls?: unknown;
  duration_seconds?: number;
  hydrated?: boolean;
  started_at?: string;
  ended_at?: string;
}

/**
 * Insert-or-merge a call by session_id. Uses the passed client — the RLS server
 * client for the session seed (owner = auth.uid()), or the admin client for the
 * webhook. `updated_at` is always stamped.
 */
export async function upsertCall(
  supabase: SupabaseClient,
  row: CallUpsert,
  now: string,
): Promise<void> {
  const { error } = await supabase
    .from("calls")
    .upsert({ ...row, updated_at: now }, { onConflict: "session_id" });
  if (error) throw new Error(`upsertCall: ${error.message}`);
}
