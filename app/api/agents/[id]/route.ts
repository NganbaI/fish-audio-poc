// GET   /api/agents/[id] — the stored agent record for the current user (RLS-scoped).
// PATCH /api/agents/[id] — update config, re-apply to Fish, re-publish, persist.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgentRecord, updateAgentRecord } from "@/lib/agents";
import { updateAgentConfig, publishAgent } from "@/lib/fish";
import { buildAgentConfig, type AgentFormInput } from "@/lib/agent-config";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const agent = await getAgentRecord(supabase, id);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS-scoped read enforces ownership.
  const existing = await getAgentRecord(supabase, id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  let input: AgentFormInput;
  try {
    input = (await request.json()) as AgentFormInput;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!input.name?.trim() || !input.systemPrompt?.trim()) {
    return NextResponse.json(
      { error: "name and systemPrompt are required" },
      { status: 400 },
    );
  }

  try {
    const config = buildAgentConfig(input);

    // Re-apply to the Fish draft and publish a new version.
    await updateAgentConfig(existing.fish_agent_id, config);
    await publishAgent(existing.fish_agent_id);

    // Persist name + config in Supabase.
    const record = await updateAgentRecord(supabase, id, {
      name: input.name.trim(),
      config,
    });

    return NextResponse.json({ agent: record });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
