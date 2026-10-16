"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, MoreVertical, Pencil, Plus, Search, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDialogTarget } from "@/hooks/use-dialog-target";
import { deleteService, searchEnvironmentVars, type VariableSearchMatch } from "@/lib/envpack/actions";
import type { Environment, ServiceSummary } from "@/lib/envpack/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { ServiceDialog } from "./service-dialog";

export function ServicesPanel({ environment, services }: { environment: Environment; services: ServiceSummary[] }) {
  const [query, setQuery] = useState("");
  const [valueMatches, setValueMatches] = useState<VariableSearchMatch[]>([]);
  const [searchingValues, setSearchingValues] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = useDialogTarget<ServiceSummary>();
  const deleting = useDialogTarget<ServiceSummary>();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setValueMatches([]);
      setSearchError(null);
      setSearchingValues(false);
      return;
    }

    let current = true;
    const timer = window.setTimeout(() => {
      setSearchingValues(true);
      setSearchError(null);
      searchEnvironmentVars(environment.id, term)
        .then((result) => {
          if (!current) return;
          if (result.ok) setValueMatches(result.matches);
          else {
            setValueMatches([]);
            setSearchError(result.error);
          }
        })
        .catch(() => {
          if (current) setSearchError("Could not search environment values. Please try again.");
        })
        .finally(() => {
          if (current) setSearchingValues(false);
        });
    }, 250);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [environment.id, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.developers.some((developer) => developer.name.toLowerCase().includes(q) || developer.email.toLowerCase().includes(q)),
    );
  }, [services, query]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-base font-semibold">Services</h2>
          <p className="text-sm text-muted-foreground">
            {services.length} service{services.length === 1 ? "" : "s"} · {environment.var_count} variable
            {environment.var_count === 1 ? "" : "s"} in {environment.name}
            {environment.description && <> · {environment.description}</>}
          </p>
        </div>
        {services.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services, developers, variables, or values…"
              className="h-9 bg-background pl-8"
            />
          </div>
        )}
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus /> Add service
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <Server className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No services yet</p>
            <p className="text-sm text-muted-foreground">
              Services are shared by all environments. Add one, then fill in its values per environment.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add service
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-background px-6 py-10 text-center text-sm text-muted-foreground">
          No services match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10">
          {filtered.map((service) => (
            <li
              key={service.id}
              className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <Link
                href={`/env-pack/${environment.id}/services/${service.id}`}
                className="absolute inset-0 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                aria-label={`Open ${service.name}`}
              />
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Server className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{service.name}</p>
                {service.description && (
                  <p className="truncate text-xs text-muted-foreground">{service.description}</p>
                )}
                {service.developers.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    Backend: {service.developers.map((developer) => `${developer.name} (${developer.email})`).join(", ")}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex sm:w-44",
                  service.var_count === 0 && "text-amber-600",
                )}
              >
                <KeyRound className="size-3.5" />
                {service.var_count === 0
                  ? `No values in ${environment.name}`
                  : `${service.var_count} variable${service.var_count === 1 ? "" : "s"}`}
              </span>
              <span
                className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground md:block"
                suppressHydrationWarning
              >
                {timeAgo(service.updated_at)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="relative z-10"
                      aria-label={`${service.name} actions`}
                    />
                  }
                >
                    <MoreVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => editing.show(service)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => deleting.show(service)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && (
        <section className="grid gap-3" aria-live="polite">
          <div>
            <h3 className="text-sm font-semibold">Matching environment values</h3>
            <p className="text-xs text-muted-foreground">Searching keys and values in {environment.name}</p>
          </div>
          {searchingValues ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Searching values…</p>
          ) : searchError ? (
            <p className="text-sm text-destructive">{searchError}</p>
          ) : valueMatches.length ? (
            <ul className="grid gap-2">
              {valueMatches.map((match) => (
                <li key={`${match.serviceId}:${match.key}`} className="min-w-0 rounded-lg border bg-background p-3">
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                    <span className="font-medium">{match.serviceName}</span>
                    <code className="text-muted-foreground">{match.key}</code>
                  </div>
                  <code className="block max-h-32 overflow-auto break-all whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{match.value || "(empty value)"}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No environment values match “{query.trim()}”.</p>
          )}
          {!searchingValues && valueMatches.length === 50 && <p className="text-xs text-muted-foreground">Showing the first 50 matches.</p>}
        </section>
      )}

      <ServiceDialog open={creating} onOpenChange={setCreating} environmentId={environment.id} />
      <ServiceDialog
        open={editing.open}
        onOpenChange={editing.onOpenChange}
        environmentId={environment.id}
        service={editing.target}
      />
      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.onOpenChange}
        title={`Delete ${deleting.target?.name}?`}
        description={
          <>
            This deletes the service from <strong>every environment</strong>, including its{" "}
            <strong>{deleting.target?.total_var_count} variables</strong>. This cannot be undone.
          </>
        }
        confirmPhrase={deleting.target && deleting.target.total_var_count > 0 ? deleting.target.name : undefined}
        actionLabel="Delete service"
        onConfirm={async () => {
          const target = deleting.target;
          if (!target) return true;
          const res = await deleteService(target.id);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`Service "${target.name}" deleted`);
          return true;
        }}
      />
    </section>
  );
}
