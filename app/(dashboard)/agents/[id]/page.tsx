import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAgentRecord } from "@/lib/agents";
import { VoiceCall } from "@/components/voice-call";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const agent = await getAgentRecord(supabase, id);
  if (!agent) notFound();

  const config = agent.config ?? {};
  const analysis = config.analysis ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{agent.name ?? "Agent"}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {agent.fish_agent_id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={<Link href={`/agents/${agent.id}/edit`} />}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            ← Back
          </Button>
        </div>
      </div>

      <Tabs defaultValue="test">
        <TabsList>
          <TabsTrigger value="test">Test</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="test">
          <VoiceCall agentId={agent.id} />
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Language</span>
                <p>{config.voice?.speaking_language ?? "en"}</p>
              </div>
              {config.voice?.voice_id && (
                <div>
                  <span className="text-muted-foreground">Voice id</span>
                  <p className="font-mono text-xs">{config.voice.voice_id}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">System prompt</span>
                <p className="whitespace-pre-wrap">{config.prompt?.system_prompt}</p>
              </div>
              {config.prompt?.first_message && (
                <div>
                  <span className="text-muted-foreground">First message</span>
                  <p>{config.prompt.first_message}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(analysis.data_fields ?? []).map((f) => (
                  <Badge key={f.name} variant="secondary">
                    {f.name}: {f.type}
                  </Badge>
                ))}
                {(analysis.criteria ?? []).map((c) => (
                  <Badge key={c.name} variant="outline">
                    ✓ {c.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
