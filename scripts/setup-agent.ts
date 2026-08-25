/**
 * Run-once: create → configure → publish one demo Fish Audio voice agent.
 *
 *   npx tsx scripts/setup-agent.ts
 *
 * Requires FISH_API_KEY in the environment (loaded from .env.local below).
 * Writes the resulting agent id to agent.json (git-ignored) and prints the line
 * to add to .env.local as FISH_AGENT_ID.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createAgent, updateAgentConfig, publishAgent } from "@/lib/fish";
import type { AgentConfig } from "@/lib/types";

// Minimal .env.local loader (avoids a dotenv dependency for a one-off script).
async function loadEnvLocal(): Promise<void> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), ".env.local"),
      "utf8",
    );
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

const SYSTEM_PROMPT = `You are Ava, a friendly outbound sales development representative for a SaaS company called Acme.
Your goal on this call is to qualify the prospect: confirm you're speaking with the right person, briefly explain
that Acme helps teams automate customer outreach, and find out (1) whether they're interested in a demo,
(2) their rough team size or budget, and (3) a good time to follow up.

Keep turns short and conversational — one question at a time. If the person is busy or not interested, thank them
politely and end the call. Never invent pricing; if asked, say a specialist will follow up with details.`.trim();

const CONFIG: AgentConfig = {
  prompt: {
    system_prompt: SYSTEM_PROMPT,
    first_message:
      "Hi, this is Ava calling from Acme — is now an okay time for a quick thirty-second question?",
  },
  voice: {
    speaking_language: "en",
    // voice_id: "<set a Fish voice model id here>",
  },
  conversation: {
    eagerness: "balanced",
    interruptible: true,
    interruption_sensitivity: "balanced",
    record_audio: true,
    max_duration_seconds: 300,
  },
  analysis: {
    summary: { enabled: true, language: "en" },
    // The POC's lead-scoring / task-extraction analogue:
    data_fields: [
      {
        name: "interested",
        type: "boolean",
        description: "Did the prospect express interest in a demo or learning more?",
      },
      {
        name: "team_size_or_budget",
        type: "text",
        description: "Any team size, budget, or company-size signal the prospect mentioned.",
      },
      {
        name: "callback_time",
        type: "text",
        description: "A follow-up time the prospect suggested, if any.",
      },
    ],
    criteria: [
      {
        name: "qualified",
        description:
          "Mark success if the prospect is interested AND gave either a budget/size signal or a callback time.",
      },
    ],
  },
};

async function main(): Promise<void> {
  await loadEnvLocal();

  console.log("Creating agent…");
  const agent = await createAgent("VOLA-lite POC — Ava (SDR)");
  console.log(`  created agent id: ${agent.id}`);

  console.log("Applying config (prompt / voice / conversation / analysis)…");
  await updateAgentConfig(agent.id, CONFIG);

  console.log("Publishing…");
  await publishAgent(agent.id);

  await fs.writeFile(
    path.join(process.cwd(), "agent.json"),
    JSON.stringify({ agentId: agent.id }, null, 2),
    "utf8",
  );

  console.log("\n✅ Done. Agent created, configured, and published.");
  console.log(`\nAdd this to your .env.local:\n  FISH_AGENT_ID=${agent.id}\n`);
}

main().catch((err) => {
  console.error("\n❌ setup-agent failed:\n", err);
  process.exit(1);
});
