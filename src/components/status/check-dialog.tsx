"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnvBadge } from "@/components/envpack/env-badge";
import { checkNow, deleteCheck, saveCheck } from "@/lib/status/actions";
import type { HealthCheck } from "@/lib/status/types";
import { HistoryBars, STATE_LABEL, StatusDot } from "./status-dot";

export type CellTarget = {
  service: { id: number; name: string };
  environment: { id: number; name: string };
  check: HealthCheck | null;
};

type Props = { open: boolean; onOpenChange: (open: boolean) => void; target: CellTarget | null };

export function CheckDialog({ open, onOpenChange, target }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {target && <CheckForm key={`${target.service.id}-${target.environment.id}`} target={target} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CheckForm({ target, onDone }: { target: CellTarget; onDone: () => void }) {
  const { service, environment, check } = target;
  const [url, setUrl] = useState(check?.url ?? "");
  const [expectedStatus, setExpectedStatus] = useState(String(check?.expected_status ?? 200));
  const [expectText, setExpectText] = useState(check?.expect_text ?? "");
  const [enabled, setEnabled] = useState(check?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveCheck(service.id, environment.id, {
        url,
        expectedStatus: Number(expectedStatus),
        expectText,
        enabled,
      });
      if (!res.ok) return setError(res.error);
      toast.success(`Health check saved for ${service.name} (${environment.name})`);
      onDone();
    });
  }

  return (
    <form onSubmit={onSave} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {service.name} <EnvBadge name={environment.name} />
        </DialogTitle>
        <DialogDescription>
          Checked every 2 minutes. Up = expected status, contains the text (if set), and no{" "}
          <code className="font-mono">&quot;success&quot;: false</code> in a JSON response.
        </DialogDescription>
      </DialogHeader>

      {check?.last && (
        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot state={check.state} />
            <span className="font-medium">{STATE_LABEL[check.state]}</span>
            {check.last.status_code && <span className="text-muted-foreground">HTTP {check.last.status_code}</span>}
            {check.last.latency_ms != null && <span className="text-muted-foreground">{check.last.latency_ms} ms</span>}
            {check.uptime_24h != null && <span className="text-muted-foreground">· {check.uptime_24h}% up (24h)</span>}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(check.last.checked_at).toLocaleTimeString()}
            </span>
          </div>
          {check.last.error && <p className="text-xs text-destructive">{check.last.error}</p>}
          {check.last.snippet && (
            <pre className="max-h-24 overflow-auto rounded-md bg-background p-2 font-mono text-xs break-all whitespace-pre-wrap">
              {check.last.snippet}
            </pre>
          )}
          <HistoryBars recent={check.recent} />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="check-url">Health URL</Label>
        <div className="flex gap-2">
          <Input
            id="check-url"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={`https://${service.name}.example.com/`}
            className="font-mono"
            disabled={pending}
          />
          {check && (
            <a
              href={check.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border hover:bg-muted"
              aria-label="Open URL"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="check-status">Expected status</Label>
          <Input
            id="check-status"
            inputMode="numeric"
            value={expectedStatus}
            onChange={(e) => setExpectedStatus(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="check-text">
            Must contain <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="check-text"
            value={expectText}
            onChange={(e) => setExpectText(e.target.value)}
            placeholder="Hello world"
            disabled={pending}
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} disabled={pending} />
        Enabled (uncheck to pause)
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="sm:justify-between">
        <div className="flex gap-2">
          {check && (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteCheck(check.id);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Health check removed");
                    onDone();
                  })
                }
              >
                <Trash2 /> Remove
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !check.enabled}
                onClick={() =>
                  startTransition(async () => {
                    const res = await checkNow(check.id);
                    if (!res.ok) toast.error(res.error);
                  })
                }
              >
                <RefreshCw /> Check now
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button type="submit" disabled={pending || !url.trim()}>
            {pending && <Loader2 className="animate-spin" />}
            Save & check
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
