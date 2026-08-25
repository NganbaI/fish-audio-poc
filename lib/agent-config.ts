// Shared builder: turn form/script input into a Fish AgentConfig. Used by both the
// create API route and scripts/setup-agent.ts so there is one source of truth.

import type { AgentConfig, AnalysisDataField, AnalysisCriterion } from "@/lib/types";

export interface AgentFormInput {
  name: string;
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  language?: string;
  eagerness?: "relaxed" | "balanced" | "eager";
  interruptible?: boolean;
  interruptionSensitivity?: "low" | "balanced" | "high";
  maxDurationSeconds?: number;
  dataFields?: AnalysisDataField[];
  criteria?: AnalysisCriterion[];
}

const LANGUAGES = ["en", "ja", "zh", "ko", "es", "fr", "de"] as const;
export type Language = (typeof LANGUAGES)[number];

export function isLanguage(v: string): v is Language {
  return (LANGUAGES as readonly string[]).includes(v);
}

export const LANGUAGE_OPTIONS = LANGUAGES;

/** Reverse of buildAgentConfig: prefill form input from a stored config. */
export function configToFormInput(
  name: string,
  config: AgentConfig,
): AgentFormInput {
  return {
    name,
    systemPrompt: config.prompt?.system_prompt ?? "",
    firstMessage: config.prompt?.first_message ?? "",
    voiceId: config.voice?.voice_id ?? "",
    language: config.voice?.speaking_language ?? "en",
    eagerness: config.conversation?.eagerness ?? "balanced",
    interruptible: config.conversation?.interruptible ?? true,
    interruptionSensitivity:
      config.conversation?.interruption_sensitivity ?? "balanced",
    maxDurationSeconds: config.conversation?.max_duration_seconds ?? 300,
    dataFields: config.analysis?.data_fields ?? [],
    criteria: config.analysis?.criteria ?? [],
  };
}

/** Assemble the PATCH-able config from validated form input. */
export function buildAgentConfig(input: AgentFormInput): AgentConfig {
  const config: AgentConfig = {
    prompt: {
      system_prompt: input.systemPrompt,
      ...(input.firstMessage ? { first_message: input.firstMessage } : {}),
    },
    voice: {
      speaking_language: input.language ?? "en",
      ...(input.voiceId ? { voice_id: input.voiceId } : {}),
    },
    conversation: {
      eagerness: input.eagerness ?? "balanced",
      interruptible: input.interruptible ?? true,
      interruption_sensitivity: input.interruptionSensitivity ?? "balanced",
      record_audio: true,
      max_duration_seconds: input.maxDurationSeconds ?? 300,
    },
    analysis: {
      summary: { enabled: true, language: input.language ?? "en" },
      ...(input.dataFields && input.dataFields.length
        ? { data_fields: input.dataFields }
        : {}),
      ...(input.criteria && input.criteria.length
        ? { criteria: input.criteria }
        : {}),
    },
  };
  return config;
}
