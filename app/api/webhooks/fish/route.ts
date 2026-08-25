// POST /api/webhooks/fish — receive Fish Audio call webhooks (HMAC-verified).
//
// Events: call.ended (+ended_reason), call.analyzed (+analysis), phone_call.dial_finished.
// GOTCHA (confirmed in research): webhook payloads OMIT transcript & recording — on
// call.analyzed we hydrate via normalizeSession() (getSession + getRecording).
//
// Writes go through the Supabase service-role client (bypasses RLS); owner_user_id
// is resolved by looking up the call's Fish agent id in the agents table.
//
// Point the Fish console webhook at:  ${PUBLIC_BASE_URL}/api/webhooks/fish

import { NextResponse } from "next/server";
import { verifyFishWebhook } from "@/lib/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentByFishId } from "@/lib/agents";
import { upsertCall, type CallUpsert } from "@/lib/calls";
import { normalizeSession } from "@/lib/fish-session";
import type { CallAnalysis } from "@/lib/types";

export const runtime = "nodejs";

interface FishWebhookEvent {
  type: string;
  session_id?: string;
  agent_id?: string;
  ended_reason?: string;
  answered_by?: string;
  dial_status?: string;
  analysis?: CallAnalysis;
  [k: string]: unknown;
}

export async function POST(request: Request) {
  const secret = process.env.FISH_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "FISH_WEBHOOK_SECRET is not set" },
      { status: 500 },
    );
  }

  // Read the RAW body first — HMAC is computed over exact bytes.
  const rawBody = await request.text();
  const signature = request.headers.get("x-fish-webhook-signature");

  const verdict = verifyFishWebhook(rawBody, signature, secret, Date.now());
  if (!verdict.ok) {
    console.warn(`[webhook] rejected: ${verdict.reason}`);
    return NextResponse.json(
      { error: "invalid signature", reason: verdict.reason },
      { status: 401 },
    );
  }

  let event: FishWebhookEvent;
  try {
    event = JSON.parse(rawBody) as FishWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const sessionId = event.session_id;
  if (!sessionId) {
    return NextResponse.json({ ok: true, note: "no session_id" });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Resolve the owner via the agent's Fish id (best-effort).
  let ownerUserId: string | undefined;
  let agentRecordId: string | undefined;
  if (event.agent_id) {
    try {
      const rec = await getAgentByFishId(admin, event.agent_id);
      if (rec) {
        ownerUserId = rec.owner_user_id;
        agentRecordId = rec.id;
      }
    } catch (err) {
      console.error("[webhook] owner lookup failed:", err);
    }
  }

  const base: CallUpsert = {
    session_id: sessionId,
    ...(event.agent_id ? { fish_agent_id: event.agent_id } : {}),
    ...(agentRecordId ? { agent_id: agentRecordId } : {}),
    ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
  };

  switch (event.type) {
    case "call.ended":
      await upsertCall(
        admin,
        { ...base, status: "ended", ended_reason: event.ended_reason, ended_at: now },
        now,
      );
      break;

    case "call.analyzed": {
      const s = await normalizeSession(sessionId);
      // Prefer analysis from the session; fall back to the webhook payload.
      const analysis = s.analysis ?? event.analysis;
      await upsertCall(
        admin,
        {
          ...base,
          status: "analyzed",
          language: s.language,
          summary:
            s.summary ??
            (typeof event.analysis?.summary === "string"
              ? event.analysis.summary
              : undefined),
          analysis,
          transcript: s.transcript,
          tool_calls: s.toolCalls,
          recording_urls: s.recordingUrls,
          duration_seconds: s.durationSeconds,
          started_at: s.startedAt,
          ended_at: s.endedAt ?? now,
          raw: s.raw,
          hydrated: s.hydrated,
        },
        now,
      );
      break;
    }

    case "phone_call.dial_finished":
      await upsertCall(admin, { ...base, status: "in_progress" }, now);
      break;

    default:
      console.log(`[webhook] unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ ok: true });
}
