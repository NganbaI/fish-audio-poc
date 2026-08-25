// GET /api/voices — proxy the Fish Models API so the agent form can offer a voice
// picker. Requires auth; returns [] gracefully if the Models API is unavailable.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listVoices } from "@/lib/fish";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch {
    // Non-fatal: the form falls back to a free-text voice_id.
    return NextResponse.json({ voices: [] });
  }
}
