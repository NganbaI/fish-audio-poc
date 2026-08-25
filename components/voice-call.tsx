"use client";

// The core browser voice loop. Fetches a single-use session token from our
// /api/session route, then hands it to the Fish web SDK's useConversation hook,
// which owns the mic → ASR → LLM → TTS pipeline over LiveKit WebRTC.

import { useCallback, useRef, useState } from "react";
import {
  useConversation,
  useAgentMessages,
  AgentAudioVisualizer,
} from "@fishaudio/agent-react";
import type { SessionToken } from "@fishaudio/agent-client";
import { toast } from "sonner";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MODE_LABEL: Record<string, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function VoiceCall() {
  const {
    session,
    status,
    mode,
    micMuted,
    startSession,
    endSession,
    setMicMuted,
  } = useConversation();
  const messages = useAgentMessages(session);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSessionId = useRef<string | null>(null);

  const active = status === "connected" || status === "reconnecting";

  const handleStart = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      // 1) Mint a token server-side (keeps FISH_API_KEY off the client).
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Session request failed (${res.status})`);
      }
      const token = (await res.json()) as SessionToken;
      lastSessionId.current = token.session_id;

      // 2) Start the live session with the token (prompts for mic permission).
      await startSession({ sessionToken: token });
      toast.success("Connected — say hello!");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }, [startSession]);

  const handleEnd = useCallback(async () => {
    await endSession();
    toast("Call ended", {
      description: lastSessionId.current
        ? "Analysis arrives via webhook shortly."
        : undefined,
    });
  }, [endSession]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Talk to the agent</CardTitle>
            <CardDescription>
              Browser voice session over the Fish Audio Voice Agents platform.
            </CardDescription>
          </div>
          <Badge variant={active ? "default" : "secondary"}>
            {active ? MODE_LABEL[mode] ?? "Connected" : status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t start the call</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-center rounded-lg border bg-muted/30 py-8">
          {active ? (
            <AgentAudioVisualizer session={session} className="text-primary" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Press <span className="font-medium text-foreground">Start call</span> to begin.
            </p>
          )}
        </div>

        <ScrollArea className="h-64 rounded-lg border p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Transcript will appear here as you talk.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.key}
                  className={
                    m.role === "agent"
                      ? "flex flex-col gap-1"
                      : "flex flex-col items-end gap-1"
                  }
                >
                  <span className="text-xs text-muted-foreground">
                    {m.role === "agent" ? "Agent" : "You"}
                  </span>
                  <span
                    className={
                      m.role === "agent"
                        ? "rounded-lg bg-muted px-3 py-2 text-sm"
                        : "rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    }
                  >
                    {m.text}
                    {!m.final && <span className="opacity-50"> …</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {!active ? (
            <Button onClick={handleStart} disabled={starting}>
              <Phone data-icon="inline-start" />
              {starting ? "Connecting…" : "Start call"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleEnd}>
              <PhoneOff data-icon="inline-start" />
              End call
            </Button>
          )}
          {active && (
            <Button
              variant="outline"
              onClick={() => setMicMuted(!micMuted)}
            >
              {micMuted ? (
                <MicOff data-icon="inline-start" />
              ) : (
                <Mic data-icon="inline-start" />
              )}
              {micMuted ? "Unmute" : "Mute"}
            </Button>
          )}
        </div>
        <Button variant="ghost" nativeButton={false} render={<Link href="/calls" />}>
          View call history
        </Button>
      </CardFooter>
    </Card>
  );
}
