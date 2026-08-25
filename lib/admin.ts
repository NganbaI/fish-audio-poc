// Super-admin helpers. `isCurrentUserAdmin` checks membership with the RLS server
// client (the admins_select_self policy lets a user read their own row). The
// cross-user reads use the service-role admin client (bypasses RLS) AFTER the
// caller has verified admin status.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentRecord } from "@/lib/agents";
import type { CallRecord } from "@/lib/types";

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/** userId → email map, via the service-role auth admin API (paginated). */
async function emailMap(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return map;
  for (const u of data.users) {
    if (u.email) map.set(u.id, u.email);
  }
  return map;
}

export interface AdminAgentRow extends AgentRecord {
  ownerEmail?: string;
}

export interface AdminCallRow extends CallRecord {
  ownerEmail?: string;
}

export interface AdminData {
  agents: AdminAgentRow[];
  calls: AdminCallRow[];
  userCount: number;
}

/**
 * Read ALL agents and calls across every user, with owner emails resolved.
 * Caller MUST have verified isCurrentUserAdmin() first — this uses the
 * service-role client and is not itself gated.
 */
export async function getAdminData(): Promise<AdminData> {
  const admin = createAdminClient();
  const emails = await emailMap(admin);

  const [{ data: agents }, { data: calls }] = await Promise.all([
    admin.from("agents").select("*").order("created_at", { ascending: false }),
    admin.from("calls").select("*").order("created_at", { ascending: false }),
  ]);

  const agentRows: AdminAgentRow[] = (agents ?? []).map((a) => ({
    ...(a as AgentRecord),
    ownerEmail: emails.get((a as AgentRecord).owner_user_id),
  }));

  const callRows: AdminCallRow[] = (calls ?? []).map((c) => {
    const row = c as Record<string, unknown>;
    return {
      id: row.session_id as string,
      agentId: (row.fish_agent_id as string) ?? undefined,
      status: (row.status as string) ?? "created",
      summary: (row.summary as string) ?? undefined,
      analysis: (row.analysis as CallRecord["analysis"]) ?? undefined,
      createdAt: (row.created_at as string) ?? new Date(0).toISOString(),
      updatedAt: (row.updated_at as string) ?? new Date(0).toISOString(),
      ownerEmail: row.owner_user_id
        ? emails.get(row.owner_user_id as string)
        : undefined,
    };
  });

  return {
    agents: agentRows,
    calls: callRows,
    userCount: emails.size,
  };
}
