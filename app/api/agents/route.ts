// GET  /api/agents — list the current user's agents.
// POST /api/agents — create a Fish agent (create → config → publish) and record it.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAgent, updateAgentConfig, publishAgent } from "@/lib/fish";
import { buildAgentConfig, type AgentFormInput } from "@/lib/agent-config";
import { listAgentsForUser, createAgentRecord } from "@/lib/agents";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const agents = await listAgentsForUser(supabase);
    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

    // 1) create draft → 2) apply config → 3) publish
    const agent = await createAgent(input.name.trim());
    await updateAgentConfig(agent.id, config);
    await publishAgent(agent.id);

    // 4) record ownership in Supabase (RLS enforces owner = auth.uid()).
    const record = await createAgentRecord(supabase, {
      fishAgentId: agent.id,
      name: input.name.trim(),
      config,
      ownerUserId: user.id,
    });

    return NextResponse.json({ agent: record }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
