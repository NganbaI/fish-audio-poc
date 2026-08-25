// POST /api/webhooks/fish — receive Fish Audio call webhooks (HMAC-verified).
//
// Events: call.ended (+ended_reason), call.analyzed (+analysis), phone_call.dial_finished.
// GOTCHA (confirmed in research): webhook payloads OMIT transcript & recording — on
// call.analyzed we hydrate via getSession() + getRecording().
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
import { getSession, getRecording } from "@/lib/fish";
import type { CallAnalysis, StoredTranscriptItem } from "@/lib/types";

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

interface Hydrated {
  transcript?: StoredTranscriptItem[];
  recording_urls?: string[];
  duration_seconds?: number;
  hydrated: boolean;
}

/** Pull transcript + recording from the read API (webhooks don't include them). */
async function hydrate(sessionId: string): Promise<Hydrated> {
  const out: Hydrated = { hydrated: false };

  try {
    const session = await getSession(sessionId);
    const items = (session.items ?? session.timeline ?? session.messages) as
      | unknown[]
      | undefined;
    if (Array.isArray(items)) {
      out.transcript = items
        .map((it): StoredTranscriptItem | null => {
          const o = it as Record<string, unknown>;
          const role = (o.role ?? o.speaker) as string | undefined;
          const text = (o.text ?? o.message ?? o.content) as string | undefined;
          if (!role || typeof text !== "string") return null;
          return {
            role,
            text,
            seconds:
              typeof o.time_in_call_secs === "number"
                ? o.time_in_call_secs
                : undefined,
          };
        })
        .filter((x): x is StoredTranscriptItem => x !== null);
    }
    if (typeof session.duration_seconds === "number") {
      out.duration_seconds = session.duration_seconds;
    }
  } catch (err) {
    console.error(`[webhook] getSession(${sessionId}) failed:`, err);
  }

  try {
    const rec = await getRecording(sessionId);
    const tracks = (rec.tracks ?? rec.recordings ?? rec.urls) as
      | unknown[]
      | undefined;
    if (Array.isArray(tracks)) {
      out.recording_urls = tracks
        .map((t) => {
          if (typeof t === "string") return t;
          const o = t as Record<string, unknown>;
          return (o.url ?? o.signed_url) as string | undefined;
        })
        .filter((u): u is string => typeof u === "string");
    } else if (typeof rec.url === "string") {
      out.recording_urls = [rec.url];
    }
  } catch (err) {
    console.error(`[webhook] getRecording(${sessionId}) failed:`, err);
  }

  out.hydrated = Boolean(out.transcript || out.recording_urls);
  return out;
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
      const analysis = event.analysis ?? {};
      const hydrated = await hydrate(sessionId);
      await upsertCall(
        admin,
        {
          ...base,
          status: "analyzed",
          summary:
            typeof analysis.summary === "string" ? analysis.summary : undefined,
          analysis,
          ...hydrated,
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
