// POST /api/session — mint a single-use browser session token for the current
// user's agent. Resolves the Supabase agent record (RLS-scoped ⇒ ownership check),
// creates a Fish session against its fish_agent_id, and seeds a call row.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentRecord } from "@/lib/agents";
import { createSession } from "@/lib/fish";
import { upsertCall } from "@/lib/calls";
import type { AgentSessionCreateRequest } from "@fishaudio/agent-protocol";

export const runtime = "nodejs";

interface SessionRequestBody {
  agentId?: string; // Supabase agent record id
  dynamicVariables?: Record<string, string | number | boolean>;
  name?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: SessionRequestBody = {};
  try {
    body = (await request.json()) as SessionRequestBody;
  } catch {
    // empty body ok
  }

  // Resolve the agent — either the selected record, or the legacy env agent.
  let fishAgentId: string | undefined;
  let agentRecordId: string | undefined;
  if (body.agentId) {
    const record = await getAgentRecord(supabase, body.agentId); // RLS-scoped
    if (!record) {
      return NextResponse.json({ error: "agent not found" }, { status: 404 });
    }
    fishAgentId = record.fish_agent_id;
    agentRecordId = record.id;
  } else {
    fishAgentId = process.env.FISH_AGENT_ID;
  }

  if (!fishAgentId) {
    return NextResponse.json(
      { error: "No agent selected and FISH_AGENT_ID is not set." },
      { status: 400 },
    );
  }

  const req: AgentSessionCreateRequest = {
    agent_id: fishAgentId,
    name: body.name ?? "Browser POC call",
    dynamic_variables: body.dynamicVariables,
  };

  try {
    const token = await createSession(req);

    // Seed the call row via the admin client (RLS is read-only for users).
    const admin = createAdminClient();
    await upsertCall(
      admin,
      {
        session_id: token.session_id,
        fish_agent_id: fishAgentId,
        agent_id: agentRecordId ?? null,
        owner_user_id: user.id,
        status: "created",
        source: "web",
      },
      new Date().toISOString(),
    );

    return NextResponse.json(token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
