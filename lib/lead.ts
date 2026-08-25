// Derive a simple "lead" label from post-call analysis — the POC's stand-in for
// VOLA's OpenAI lead-scoring. Prefers explicit success criteria; falls back to the
// `interested` data field.

import type { CallAnalysis } from "@/lib/types";

export type LeadLabel = "hot" | "warm" | "cold" | "unknown";

export function deriveLead(analysis?: CallAnalysis): LeadLabel {
  if (!analysis) return "unknown";

  const criteria = analysis.criteria ?? {};
  if (criteria.qualified === "success") return "hot";
  if (criteria.qualified === "failure") return "cold";

  const fields = analysis.data_fields ?? {};
  if (fields.interested === true) return "warm";
  if (fields.interested === false) return "cold";

  return "unknown";
}

export const LEAD_VARIANT: Record<
  LeadLabel,
  "default" | "secondary" | "destructive" | "outline"
> = {
  hot: "default",
  warm: "secondary",
  cold: "destructive",
  unknown: "outline",
};
