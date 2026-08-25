// POST /api/session — mint a single-use browser session token server-side, so the
// Fish API key never reaches the client. Also seeds a "created" call record so the
// dashboard shows in-flight calls before the webhook lands.

import { NextResponse } from "next/server";
import { createSession } from "@/lib/fish";
import { upsertCall } from "@/lib/store";
import type { AgentSessionCreateRequest } from "@fishaudio/agent-protocol";

export const runtime = "nodejs";

interface SessionRequestBody {
  dynamicVariables?: Record<string, string | number | boolean>;
  name?: string;
}

export async function POST(request: Request) {
  const agentId = process.env.FISH_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      { error: "FISH_AGENT_ID is not set. Run: npx tsx scripts/setup-agent.ts" },
      { status: 500 },
    );
  }

  let body: SessionRequestBody = {};
  try {
    body = (await request.json()) as SessionRequestBody;
  } catch {
    // Empty body is fine.
  }

  const req: AgentSessionCreateRequest = {
    agent_id: agentId,
    name: body.name ?? "Browser POC call",
    dynamic_variables: body.dynamicVariables,
  };

  try {
    const token = await createSession(req);
    const now = new Date().toISOString();
    await upsertCall(
      token.session_id,
      { id: token.session_id, agentId, status: "created", source: "web" },
      now,
    );
    // Return the whole SessionToken — the web SDK's startSession consumes it verbatim.
    return NextResponse.json(token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
