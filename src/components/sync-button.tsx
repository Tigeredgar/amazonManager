"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { syncNow } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function SyncButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSync() {
    setError(null);
    startTransition(async () => {
      try {
        await syncNow();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sync failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="max-w-48 text-xs text-destructive">{error}</span> : null}
      <Button onClick={handleSync} disabled={disabled || pending} variant="outline">
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}
