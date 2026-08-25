import Link from "next/link";
import { listCalls } from "@/lib/store";
import { deriveLead, LEAD_VARIANT } from "@/lib/lead";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "analyzed") return "default";
  if (status === "ended") return "secondary";
  return "outline";
}

export default async function CallsPage() {
  const calls = await listCalls();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Call history</h1>
        <p className="text-muted-foreground">
          Sessions recorded by the webhook, hydrated with transcript, recording, and
          post-call analysis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <Empty className="border-none">
              <p className="text-sm text-muted-foreground">
                No calls yet. Start one on the{" "}
                <Link href="/" className="underline">
                  Call
                </Link>{" "}
                page — records appear here once the webhook fires.
              </p>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => {
                  const lead = deriveLead(call.analysis);
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/calls/${call.id}`} className="underline">
                          {call.id.slice(0, 12)}…
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(call.status)}>
                          {call.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={LEAD_VARIANT[lead]}>{lead}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {call.summary ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(call.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
