"use client";

// Create-agent form. Manages state locally and POSTs to /api/agents, which runs
// the Fish create → config → publish sequence and records ownership in Supabase.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LANGUAGE_OPTIONS } from "@/lib/agent-config";
import type {
  AnalysisCriterion,
  AnalysisDataField,
  AnalysisFieldType,
} from "@/lib/types";

interface Voice {
  id: string;
  title: string;
}

const FIELD_TYPES: AnalysisFieldType[] = ["boolean", "number", "text", "enum"];

export function AgentForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("en");
  const [eagerness, setEagerness] = useState("balanced");
  const [interruptible, setInterruptible] = useState(true);
  const [sensitivity, setSensitivity] = useState("balanced");
  const [dataFields, setDataFields] = useState<AnalysisDataField[]>([
    { name: "interested", type: "boolean", description: "Did the prospect show interest?" },
  ]);
  const [criteria, setCriteria] = useState<AnalysisCriterion[]>([
    { name: "qualified", description: "Interested and gave a budget/size or callback time." },
  ]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => (r.ok ? r.json() : { voices: [] }))
      .then((d: { voices?: Voice[] }) => setVoices(d.voices ?? []))
      .catch(() => setVoices([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Name and system prompt are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          systemPrompt,
          firstMessage: firstMessage || undefined,
          voiceId: voiceId || undefined,
          language,
          eagerness,
          interruptible,
          interruptionSensitivity: sensitivity,
          dataFields: dataFields.filter((f) => f.name.trim()),
          criteria: criteria.filter((c) => c.name.trim()),
        }),
      });
      const data = (await res.json()) as {
        agent?: { id: string };
        error?: string;
      };
      if (!res.ok || !data.agent) {
        throw new Error(data.error ?? `Create failed (${res.status})`);
      }
      toast.success("Agent created and published.");
      router.push(`/agents/${data.agent.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>New agent</CardTitle>
          <CardDescription>
            Configure a Fish Audio voice agent. It&apos;s created, configured, and
            published in one step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ava — SDR"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="systemPrompt">System prompt</FieldLabel>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={7}
                placeholder="You are Ava, a friendly SDR for Acme…"
                required
              />
              <FieldDescription>Keep under ~2,000 tokens.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="firstMessage">First message</FieldLabel>
              <Input
                id="firstMessage"
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Hi, this is Ava from Acme — is now a good time?"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="voiceId">Voice</FieldLabel>
                <Input
                  id="voiceId"
                  list="voice-options"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  placeholder="voice_id (optional)"
                />
                <datalist id="voice-options">
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </datalist>
                <FieldDescription>
                  A Fish voice model id (same as a TTS reference_id). Leave blank for
                  the default.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Language</FieldLabel>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v ?? "en")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Separator />

            <FieldSet>
              <FieldLegend>Turn-taking</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Eagerness</FieldLabel>
                  <Select
                    value={eagerness}
                    onValueChange={(v) => setEagerness(v ?? "balanced")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["relaxed", "balanced", "eager"].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Interruption sensitivity</FieldLabel>
                  <Select
                    value={sensitivity}
                    onValueChange={(v) => setSensitivity(v ?? "balanced")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "balanced", "high"].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field orientation="horizontal">
                <Switch
                  id="interruptible"
                  checked={interruptible}
                  onCheckedChange={(v) => setInterruptible(Boolean(v))}
                />
                <FieldLabel htmlFor="interruptible">
                  Allow the caller to interrupt
                </FieldLabel>
              </Field>
            </FieldSet>

            <Separator />

            <FieldSet>
              <FieldLegend>Post-call analysis</FieldLegend>
              <FieldDescription>
                Data fields extracted per call, plus success criteria (the lead-scoring
                analogue).
              </FieldDescription>

              <DataFieldsEditor value={dataFields} onChange={setDataFields} />
              <CriteriaEditor value={criteria} onChange={setCriteria} />
            </FieldSet>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create agent"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}

function DataFieldsEditor({
  value,
  onChange,
}: {
  value: AnalysisDataField[];
  onChange: (next: AnalysisDataField[]) => void;
}) {
  function update(i: number, patch: Partial<AnalysisDataField>) {
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Data fields</span>
      {value.map((f, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_2fr_auto]">
          <Input
            aria-label="field name"
            value={f.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="name"
          />
          <Select
            value={f.type}
            onValueChange={(v) =>
              update(i, { type: (v ?? "text") as AnalysisFieldType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="field description"
            value={f.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="description"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...value, { name: "", type: "text", description: "" }])
        }
      >
        <Plus data-icon="inline-start" />
        Add data field
      </Button>
    </div>
  );
}

function CriteriaEditor({
  value,
  onChange,
}: {
  value: AnalysisCriterion[];
  onChange: (next: AnalysisCriterion[]) => void;
}) {
  function update(i: number, patch: Partial<AnalysisCriterion>) {
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Success criteria</span>
      {value.map((c, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input
            aria-label="criterion name"
            value={c.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="name"
          />
          <Input
            aria-label="criterion description"
            value={c.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="description"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { name: "", description: "" }])}
      >
        <Plus data-icon="inline-start" />
        Add criterion
      </Button>
    </div>
  );
}
