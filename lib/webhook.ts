// HMAC verification for Fish Audio webhooks — mirrors VOLA's ElevenLabs pattern.
// Header: `X-Fish-Webhook-Signature: t=<unix>,v1=<hex hmac-sha256>`.
// Signed payload is `${t}.${rawBody}`; reject skew > 5 minutes; constant-time compare.

import crypto from "node:crypto";

const MAX_SKEW_SECONDS = 5 * 60;

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

function parseSignatureHeader(
  header: string | null,
): { t: number; v1: string } | null {
  if (!header) return null;
  let t: number | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const [k, val] = part.split("=");
    if (k?.trim() === "t") t = Number(val);
    else if (k?.trim() === "v1") v1 = val?.trim();
  }
  if (t === undefined || Number.isNaN(t) || !v1) return null;
  return { t, v1 };
}

/**
 * Verify a Fish webhook. `rawBody` MUST be the exact bytes received (read the
 * request as text before JSON.parse). `nowMs` is injected for testability.
 */
export function verifyFishWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs: number,
): VerifyResult {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { ok: false, reason: "missing_or_malformed_signature" };

  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.t);
  if (ageSeconds > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.t}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.v1, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}
