// Supabase-backed agent metadata. Reads/inserts run through the caller-supplied
// client: the RLS-scoped server client for user-facing ops, or the service-role
// admin client for the webhook owner lookup.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentConfig } from "@/lib/types";

export interface AgentRecord {
  id: string;
  fish_agent_id: string;
  name: string | null;
  config: AgentConfig | null;
  owner_user_id: string;
  created_at: string;
}

export async function listAgentsForUser(
  supabase: SupabaseClient,
): Promise<AgentRecord[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listAgentsForUser: ${error.message}`);
  return (data ?? []) as AgentRecord[];
}

export async function getAgentRecord(
  supabase: SupabaseClient,
  id: string,
): Promise<AgentRecord | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAgentRecord: ${error.message}`);
  return (data as AgentRecord | null) ?? null;
}

/** Look up a Fish agent id owned by a user (used to scope calls to owners). */
export async function getAgentByFishId(
  supabase: SupabaseClient,
  fishAgentId: string,
): Promise<AgentRecord | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("fish_agent_id", fishAgentId)
    .maybeSingle();
  if (error) throw new Error(`getAgentByFishId: ${error.message}`);
  return (data as AgentRecord | null) ?? null;
}

export interface CreateAgentRecordInput {
  fishAgentId: string;
  name: string;
  config: AgentConfig;
  ownerUserId: string;
}

export async function createAgentRecord(
  supabase: SupabaseClient,
  input: CreateAgentRecordInput,
): Promise<AgentRecord> {
  const { data, error } = await supabase
    .from("agents")
    .insert({
      fish_agent_id: input.fishAgentId,
      name: input.name,
      config: input.config,
      owner_user_id: input.ownerUserId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createAgentRecord: ${error.message}`);
  return data as AgentRecord;
}
