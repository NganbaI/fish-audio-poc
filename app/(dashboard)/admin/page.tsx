import { notFound } from "next/navigation";
import Link from "next/link";
import { isCurrentUserAdmin, getAdminData } from "@/lib/admin";
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

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Gate: only admins may view this page.
  if (!(await isCurrentUserAdmin())) notFound();

  const { agents, calls, userCount } = await getAdminData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">
          Global view across all users. {userCount} user
          {userCount === 1 ? "" : "s"} · {agents.length} agent
          {agents.length === 1 ? "" : "s"} · {calls.length} call
          {calls.length === 1 ? "" : "s"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All agents</CardTitle>
          <CardDescription>Every agent created by any user.</CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Fish agent id</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.name ?? "Untitled"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.ownerEmail ?? a.owner_user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.fish_agent_id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All calls</CardTitle>
          <CardDescription>Every voice session across users.</CardDescription>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => {
                  const lead = deriveLead(c.analysis);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/calls/${c.id}`} className="underline">
                          {c.id.slice(0, 12)}…
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.ownerEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={LEAD_VARIANT[lead]}>{lead}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {c.summary ?? "—"}
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
