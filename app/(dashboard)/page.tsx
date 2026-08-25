import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listAgentsForUser } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const supabase = await createClient();
  const agents = await listAgentsForUser(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-muted-foreground">
            Create a Fish Audio voice agent, then test it in the browser.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/agents/new" />}>
          <Plus data-icon="inline-start" />
          New agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Empty className="border">
          <p className="text-sm text-muted-foreground">
            No agents yet. Create your first one to start testing.
          </p>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`}>
              <Card className="transition-colors hover:border-foreground/30">
                <CardHeader>
                  <CardTitle>{a.name ?? "Untitled agent"}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {a.fish_agent_id}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
