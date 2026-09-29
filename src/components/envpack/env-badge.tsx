import { envTone, type EnvTone } from "@/lib/envpack/types";
import { cn } from "@/lib/utils";

const DOT: Record<EnvTone, string> = {
  prod: "bg-red-500",
  staging: "bg-amber-500",
  qa: "bg-sky-500",
  dev: "bg-emerald-500",
  other: "bg-zinc-400",
};

const BADGE: Record<EnvTone, string> = {
  prod: "bg-red-50 text-red-700 ring-red-200",
  staging: "bg-amber-50 text-amber-800 ring-amber-200",
  qa: "bg-sky-50 text-sky-700 ring-sky-200",
  dev: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  other: "bg-zinc-50 text-zinc-700 ring-zinc-200",
};

export function EnvDot({ name, className }: { name: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", DOT[envTone(name)], className)} />;
}

export function EnvBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE[envTone(name)],
        className,
      )}
    >
      <EnvDot name={name} />
      {name}
    </span>
  );
}
