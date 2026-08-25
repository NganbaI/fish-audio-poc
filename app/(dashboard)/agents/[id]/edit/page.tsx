import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentRecord } from "@/lib/agents";
import { configToFormInput } from "@/lib/agent-config";
import { AgentForm } from "@/components/agent-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const agent = await getAgentRecord(supabase, id);
  if (!agent) notFound();

  const input = configToFormInput(agent.name ?? "", agent.config ?? {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit agent</h1>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/agents/${agent.id}`} />}
        >
          ← Back
        </Button>
      </div>
      <AgentForm
        agentId={agent.id}
        initial={{
          name: input.name,
          systemPrompt: input.systemPrompt,
          firstMessage: input.firstMessage,
          voiceId: input.voiceId,
          language: input.language,
          eagerness: input.eagerness,
          interruptible: input.interruptible,
          interruptionSensitivity: input.interruptionSensitivity,
          dataFields: input.dataFields,
          criteria: input.criteria,
        }}
      />
    </div>
  );
}
