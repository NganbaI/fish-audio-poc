import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AgentForm } from "@/components/agent-form";

export default function NewAgentPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Create agent</h1>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          ← Back
        </Button>
      </div>
      <AgentForm />
    </div>
  );
}
