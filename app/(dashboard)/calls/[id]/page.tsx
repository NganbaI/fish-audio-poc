import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCallForUser } from "@/lib/calls";
import { deriveLead, LEAD_VARIANT } from "@/lib/lead";
import { SyncCallButton } from "@/components/sync-call-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const dynamic = "force-dynamic";

function fmtDuration(sec?: number): string | null {
  if (typeof sec !== "number") return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const call = await getCallForUser(supabase, id);
  if (!call) notFound();

  const lead = deriveLead(call.analysis);
  const dataFields = call.analysis?.data_fields ?? {};
  const criteria = call.analysis?.criteria ?? {};
  const duration = fmtDuration(call.durationSeconds);
  const needsSync = !call.hydrated;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Call detail</h1>
          <p className="font-mono text-xs text-muted-foreground">{call.id}</p>
        </div>
        <div className="flex gap-2">
          <SyncCallButton callId={call.id} autoSync={needsSync} />
          <Button variant="outline" nativeButton={false} render={<Link href="/calls" />}>
            ← Back
          </Button>
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={call.status === "analyzed" ? "default" : "secondary"}>
          {call.status}
        </Badge>
        <Badge variant={LEAD_VARIANT[lead]}>lead: {lead}</Badge>
        {call.source && <Badge variant="outline">{call.source}</Badge>}
        {call.language && <Badge variant="outline">{call.language}</Badge>}
        {duration && <Badge variant="outline">{duration}</Badge>}
        {call.endedReason && (
          <Badge variant="outline">ended: {call.endedReason}</Badge>
        )}
        {needsSync && <Badge variant="outline">not synced yet</Badge>}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Auto-generated post-call summary.</CardDescription>
        </CardHeader>
        <CardContent>
          {call.summary ? (
            <p className="text-sm leading-relaxed">{call.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No summary yet. It appears after the call is analyzed —{" "}
              <span className="font-medium">Sync from Fish</span> to fetch the latest.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Post-call analysis</CardTitle>
          <CardDescription>
            Extracted data fields and success criteria (the lead-scoring analogue).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Data fields</h3>
            {Object.keys(dataFields).length === 0 ? (
              <p className="text-sm text-muted-foreground">None extracted.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(dataFields).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col gap-0.5 rounded-lg border p-3"
                  >
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <span className="text-sm font-medium">
                      {v === null || v === "" ? "—" : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-medium">Success criteria</h3>
            {Object.keys(criteria).length === 0 ? (
              <p className="text-sm text-muted-foreground">None evaluated.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(criteria).map(([k, v]) => (
                  <Badge
                    key={k}
                    variant={
                      v === "success"
                        ? "default"
                        : v === "failure"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recording */}
      <Card>
        <CardHeader>
          <CardTitle>Recording</CardTitle>
          <CardDescription>One track per speaker.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {call.recordingUrls && call.recordingUrls.length > 0 ? (
            call.recordingUrls.map((url, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Track {i + 1}
                </span>
                <audio controls src={url} className="w-full" />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No recording available yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {!call.transcript || call.transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transcript yet. Sync from Fish once the call has ended.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {call.transcript.map((item, i) => {
                const isAgent = item.role === "agent";
                return (
                  <div
                    key={i}
                    className={
                      isAgent
                        ? "flex flex-col items-start gap-1"
                        : "flex flex-col items-end gap-1"
                    }
                  >
                    <span className="text-xs text-muted-foreground">
                      {isAgent ? "Agent" : "Caller"}
                      {typeof item.seconds === "number"
                        ? ` · ${item.seconds.toFixed(1)}s`
                        : ""}
                    </span>
                    <span
                      className={
                        isAgent
                          ? "max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm"
                          : "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      }
                    >
                      {item.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool calls */}
      {call.toolCalls && call.toolCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tool calls</CardTitle>
            <CardDescription>Functions the agent invoked.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {call.toolCalls.map((t, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  {t.source && <Badge variant="outline">{t.source}</Badge>}
                </div>
                {t.input && (
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {t.input}
                  </pre>
                )}
                {t.output && (
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {t.output}
                  </pre>
                )}
                {t.error && (
                  <p className="mt-2 text-xs text-destructive">{t.error}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Raw data — everything else Fish returned */}
      {call.raw != null && (
        <Card>
          <CardContent className="pt-6">
            <Accordion>
              <AccordionItem value="raw">
                <AccordionTrigger>
                  Raw Fish session data (everything available)
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                    {JSON.stringify(call.raw, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
