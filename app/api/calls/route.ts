// GET /api/calls — list stored call records for the dashboard.
import { NextResponse } from "next/server";
import { listCalls } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const calls = await listCalls();
  return NextResponse.json({ calls });
}
