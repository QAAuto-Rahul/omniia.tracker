import type { CheckState } from "@/lib/status/types";
import { cn } from "@/lib/utils";

const STYLES: Record<CheckState, string> = {
  up: "bg-emerald-500",
  down: "bg-red-500",
  pending: "bg-zinc-300",
  paused: "bg-zinc-300",
  not_deployed: "bg-red-600",
};

export const STATE_LABEL: Record<CheckState, string> = {
  up: "Up",
  down: "Down",
  pending: "Waiting for first check",
  paused: "Paused",
  not_deployed: "Not deployed",
};

export function StatusDot({ state, className }: { state: CheckState; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)}>
      {state === "down" && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60" />}
      <span className={cn("relative inline-flex size-2.5 rounded-full", STYLES[state])} />
    </span>
  );
}

/** Tiny bar per recent result: green = up, red = down. */
export function HistoryBars({ recent, className }: { recent: { ok: boolean; checked_at: number }[]; className?: string }) {
  return (
    <div className={cn("flex h-5 items-end gap-px", className)}>
      {recent.map((r) => (
        <span
          key={r.checked_at}
          title={`${new Date(r.checked_at).toLocaleString()} - ${r.ok ? "up" : "down"}`}
          className={cn("w-1.5 rounded-[1px]", r.ok ? "h-full bg-emerald-500/80" : "h-full bg-red-500")}
        />
      ))}
    </div>
  );
}
