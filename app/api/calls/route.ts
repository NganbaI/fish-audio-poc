// GET /api/calls — list the current user's call records (RLS-scoped).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCallsForUser } from "@/lib/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const calls = await listCallsForUser(supabase);
  return NextResponse.json({ calls });
}
