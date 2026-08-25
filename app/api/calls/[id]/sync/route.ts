// POST /api/calls/[id]/sync — pull the latest session detail + recording from Fish
// and update the stored call. Lets call output appear even when webhooks aren't
// configured. Ownership is enforced by reading the call via the RLS client first.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCallForUser, upsertCall } from "@/lib/calls";
import { normalizeSession } from "@/lib/fish-session";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS-scoped read enforces that the user owns (or is admin over) this call.
  const existing = await getCallForUser(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const s = await normalizeSession(id);
    const now = new Date().toISOString();

    // Write via admin client (RLS is read-only for users). Preserve status
    // unless the session reports a terminal one.
    const admin = createAdminClient();
    await upsertCall(
      admin,
      {
        session_id: id,
        status: s.analysis ? "analyzed" : (s.status ?? existing.status),
        language: s.language,
        summary: s.summary,
        analysis: s.analysis,
        transcript: s.transcript,
        tool_calls: s.toolCalls,
        recording_urls: s.recordingUrls,
        duration_seconds: s.durationSeconds,
        started_at: s.startedAt,
        ended_at: s.endedAt,
        raw: s.raw,
        hydrated: s.hydrated,
      },
      now,
    );

    const updated = await getCallForUser(supabase, id);
    return NextResponse.json({ call: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
