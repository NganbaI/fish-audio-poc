import Link from "next/link";
import { notFound } from "next/navigation";
import { getCall } from "@/lib/store";
import { deriveLead, LEAD_VARIANT } from "@/lib/lead";
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

export const dynamic = "force-dynamic";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getCall(id);
  if (!call) notFound();

  const lead = deriveLead(call.analysis);
  const dataFields = call.analysis?.data_fields ?? {};
  const criteria = call.analysis?.criteria ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Call detail</h1>
          <p className="font-mono text-xs text-muted-foreground">{call.id}</p>
        </div>
        <Button variant="outline" render={<Link href="/calls" />}>
          ← Back
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{call.status}</Badge>
        <Badge variant={LEAD_VARIANT[lead]}>lead: {lead}</Badge>
        {call.source && <Badge variant="outline">{call.source}</Badge>}
        {call.endedReason && (
          <Badge variant="outline">ended: {call.endedReason}</Badge>
        )}
        {!call.hydrated && call.status === "analyzed" && (
          <Badge variant="outline">not hydrated</Badge>
        )}
      </div>

      {call.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{call.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Post-call analysis</CardTitle>
          <CardDescription>
            Extracted data fields and success criteria — the POC&apos;s lead-scoring
            analogue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Data fields</h3>
            {Object.keys(dataFields).length === 0 ? (
              <p className="text-sm text-muted-foreground">None extracted.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(dataFields).map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-medium">Criteria</h3>
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

      {call.recordingUrls && call.recordingUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recording</CardTitle>
            <CardDescription>One track per speaker.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {call.recordingUrls.map((url, i) => (
              <audio key={i} controls src={url} className="w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {!call.transcript || call.transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transcript yet. It hydrates from the read API when{" "}
              <code>call.analyzed</code> fires.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {call.transcript.map((item, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {item.role}
                    {typeof item.seconds === "number"
                      ? ` · ${item.seconds.toFixed(1)}s`
                      : ""}
                  </span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
