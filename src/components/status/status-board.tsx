"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2, Plus, RefreshCw, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { EnvDot } from "@/components/envpack/env-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialogTarget } from "@/hooks/use-dialog-target";
import { checkAllNow } from "@/lib/status/actions";
import type { HealthCheck, StatusBoard } from "@/lib/status/types";
import { cn } from "@/lib/utils";
import { CheckDialog, type CellTarget } from "./check-dialog";
import { PatternDialog } from "./pattern-dialog";
import { STATE_LABEL, StatusDot } from "./status-dot";

const REFRESH_MS = 30_000;

function ago(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

export function StatusBoardView({ board }: { board: StatusBoard }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlyDown, setOnlyDown] = useState(false);
  const [onlyNotDeployed, setOnlyNotDeployed] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const cell = useDialogTarget<CellTarget>();

  // Pull fresh results in the background; the server checks every 2 minutes.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  const checkFor = useMemo(() => {
    const map = new Map<string, HealthCheck>();
    for (const c of board.checks) map.set(`${c.service_id}:${c.environment_id}`, c);
    return (serviceId: number, envId: number) => map.get(`${serviceId}:${envId}`) ?? null;
  }, [board.checks]);

  const counts = useMemo(() => {
    const c = { up: 0, down: 0, pending: 0, paused: 0, not_deployed: 0 };
    for (const check of board.checks) c[check.state]++;
    return c;
  }, [board.checks]);

  const missing = useMemo(() => {
    const out: Record<number, string[]> = {};
    for (const env of board.environments) {
      out[env.id] = board.services.filter((s) => !checkFor(s.id, env.id)).map((s) => s.name);
    }
    return out;
  }, [board, checkFor]);

  const services = board.services.filter((s) => {
    if (query && !s.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (onlyDown) return board.environments.some((e) => checkFor(s.id, e.id)?.state === "down");
    if (onlyNotDeployed) return board.environments.some((e) => checkFor(s.id, e.id)?.state === "not_deployed");
    return true;
  });

  const lastRun = board.checks.reduce((max, c) => Math.max(max, c.last?.checked_at ?? 0), 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service Health</h1>
          <p className="text-sm text-muted-foreground">
            Every service in every environment, checked every {board.intervalSeconds / 60} minutes.
            {lastRun > 0 && <span suppressHydrationWarning> Last check {ago(lastRun, now)}.</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPatternOpen(true)} disabled={!board.environments.length || !board.services.length}>
            <Wand2 /> Add from pattern
          </Button>
          <Button
            disabled={pending || board.checks.length === 0}
            onClick={() =>
              startTransition(async () => {
                const res = await checkAllNow();
                if (res.ok) toast.success(`Checked ${res.count} URLs`);
                else toast.error(res.error);
                setNow(Date.now());
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check all now
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["up", "Up", "text-emerald-600"],
            ["down", "Down", "text-red-600"],
            ["pending", "Waiting", "text-muted-foreground"],
            ["paused", "Paused", "text-muted-foreground"],
            ["not_deployed", "Not deployed", "text-red-700"],
          ] as const
        ).map(([key, label, color]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === "down") {
                setOnlyDown((v) => !v);
                setOnlyNotDeployed(false);
              }
              if (key === "not_deployed") {
                setOnlyNotDeployed((v) => !v);
                setOnlyDown(false);
              }
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-background p-4 text-left ring-1 ring-foreground/10",
              key === "down" && "cursor-pointer hover:ring-red-300",
              key === "down" && onlyDown && "ring-2 ring-red-400",
              key === "not_deployed" && "cursor-pointer hover:ring-red-300",
              key === "not_deployed" && onlyNotDeployed && "ring-2 ring-red-400",
            )}
          >
            <StatusDot state={key} />
            <div>
              <p className={cn("text-2xl font-semibold tabular-nums", color)}>{counts[key]}</p>
              <p className="text-xs text-muted-foreground">
                {label}
                {key === "down" && (onlyDown ? " · showing only down" : " · click to filter")}
              </p>
            </div>
          </button>
        ))}
      </div>

      {board.environments.length === 0 || board.services.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background px-6 py-16 text-center">
          <Activity className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="font-medium">Nothing to monitor yet</p>
          <p className="text-sm text-muted-foreground">Add environments and services in EnvPack first.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services…"
                className="pl-8"
              />
            </div>
            <p className="ml-auto hidden text-xs text-muted-foreground sm:block">Click a cell to set its URL or see details</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 bg-background px-4 py-2.5 text-left font-medium">Service</th>
                  {board.environments.map((env) => (
                    <th key={env.id} className="min-w-44 px-3 py-2.5 text-left font-medium">
                      <span className="flex items-center gap-2">
                        <EnvDot name={env.name} />
                        {env.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((service) => (
                  <tr key={service.id}>
                    <td className="sticky left-0 bg-background px-4 py-2 font-medium">{service.name}</td>
                    {board.environments.map((env) => {
                      const check = checkFor(service.id, env.id);
                      return (
                        <td key={env.id} className="p-1">
                          <button
                            type="button"
                            onClick={() => cell.show({ service, environment: env, check })}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                              check?.state === "down" && "bg-red-50 hover:bg-red-100",
                              check?.state === "not_deployed" && "bg-red-600 text-white hover:bg-red-700",
                            )}
                            title={check?.last?.error ?? check?.url ?? "Set a health URL"}
                          >
                            {check ? (
                              <>
                                <StatusDot state={check.state} />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "block text-xs font-medium",
                                      (check.state === "down" || check.state === "not_deployed") && "text-red-700",
                                      check.state === "not_deployed" && "text-white",
                                      check.state === "up" && "text-emerald-700",
                                    )}
                                  >
                                    {STATE_LABEL[check.state]}
                                    {check.last?.latency_ms != null && check.state !== "paused" && (
                                      <span className="font-normal text-muted-foreground"> · {check.last.latency_ms} ms</span>
                                    )}
                                  </span>
                                  <span className={cn("block truncate text-[11px] text-muted-foreground", check.state === "not_deployed" && "text-white/80")} suppressHydrationWarning>
                                    {check.state === "not_deployed" ? "Not deployed" : check.state === "down" && check.last?.error
                                      ? check.last.error
                                      : check.last
                                        ? `${ago(check.last.checked_at, now)}${check.uptime_24h != null ? ` · ${check.uptime_24h}% 24h` : ""}`
                                        : "pending"}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Plus className="size-3.5" /> Add URL
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={board.environments.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {onlyDown ? "Nothing is down." : onlyNotDeployed ? "No services are marked not deployed." : "No services match."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CheckDialog open={cell.open} onOpenChange={cell.onOpenChange} target={cell.target} />
      <PatternDialog
        open={patternOpen}
        onOpenChange={setPatternOpen}
        environments={board.environments}
        missing={missing}
      />
    </div>
  );
}
