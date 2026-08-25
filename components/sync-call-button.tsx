"use client";

// "Sync from Fish" — pulls the latest session detail for a call and refreshes the
// page. Auto-runs once on mount when the call isn't hydrated yet, so output shows
// up without the user having to click (and without needing webhooks configured).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncCallButtonProps {
  callId: string;
  autoSync?: boolean;
}

export function SyncCallButton({ callId, autoSync }: SyncCallButtonProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const autoRan = useRef(false);

  const sync = useCallback(
    async (silent = false) => {
      setSyncing(true);
      try {
        const res = await fetch(`/api/calls/${callId}/sync`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Sync failed (${res.status})`);
        if (!silent) toast.success("Synced from Fish.");
        router.refresh();
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setSyncing(false);
      }
    },
    [callId, router],
  );

  useEffect(() => {
    if (autoSync && !autoRan.current) {
      autoRan.current = true;
      void sync(true);
    }
  }, [autoSync, sync]);

  return (
    <Button variant="outline" onClick={() => sync(false)} disabled={syncing}>
      <RefreshCw data-icon="inline-start" className={syncing ? "animate-spin" : ""} />
      {syncing ? "Syncing…" : "Sync from Fish"}
    </Button>
  );
}
