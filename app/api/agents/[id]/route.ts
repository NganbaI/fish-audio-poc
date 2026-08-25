// GET /api/agents/[id] — the stored agent record for the current user (RLS-scoped).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgentRecord } from "@/lib/agents";

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
