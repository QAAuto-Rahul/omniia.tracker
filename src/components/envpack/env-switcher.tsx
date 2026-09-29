"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteEnvironment } from "@/lib/envpack/actions";
import { LAST_ENV_COOKIE } from "@/lib/envpack/constants";
import type { Environment } from "@/lib/envpack/types";
import { ConfirmDialog } from "./confirm-dialog";
import { EnvDot } from "./env-badge";
import { EnvironmentDialog } from "./environment-dialog";

type Props = {
  environments: Environment[];
  currentId?: number;
  /** When set, switching environment stays on this service. */
  serviceId?: number;
  /** Per-environment variable counts to show in the list (defaults to each environment's total). */
  counts?: Record<number, number>;
};

export function EnvSwitcher({ environments, currentId, serviceId, counts }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const current = environments.find((e) => e.id === currentId);
  const close = (open: boolean) => !open && setDialog(null);

  // Remember the last environment so /env-pack reopens it.
  useEffect(() => {
    if (currentId) document.cookie = `${LAST_ENV_COOKIE}=${currentId}; path=/; max-age=31536000; samesite=lax`;
  }, [currentId]);

  const hrefFor = (envId: number | string) => `/env-pack/${envId}${serviceId ? `/services/${serviceId}` : ""}`;
  const countFor = (env: Environment) => counts?.[env.id] ?? env.var_count;
  const items = environments.map((e) => ({ value: String(e.id), label: e.name }));

  return (
    <div className="flex items-center gap-1.5">
      {environments.length === 0 ? (
        <Button onClick={() => setDialog("create")}>
          <Plus /> New environment
        </Button>
      ) : (
        <>
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Environment</span>
          <Select
            items={items}
            value={current ? String(current.id) : null}
            onValueChange={(value) => value && router.push(hrefFor(value))}
          >
            <SelectTrigger className="h-9 min-w-44 bg-background font-medium" aria-label="Environment">
              {current && <EnvDot name={current.name} />}
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false} className="min-w-56">
              {environments.map((env) => (
                <SelectItem key={env.id} value={String(env.id)}>
                  <EnvDot name={env.name} />
                  <span className="flex-1">{env.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{countFor(env)} vars</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-lg" aria-label="Manage environments" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setDialog("create")}>
                <Plus /> New environment
              </DropdownMenuItem>
              {current && (
                <>
                  <DropdownMenuItem onClick={() => setDialog("edit")}>
                    <Pencil /> Edit {current.name}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
                    <Trash2 /> Delete {current.name}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <EnvironmentDialog open={dialog === "create"} onOpenChange={close} environments={environments} />
      {current && (
        <>
          <EnvironmentDialog
            open={dialog === "edit"}
            onOpenChange={close}
            environment={current}
            environments={environments}
          />
          <ConfirmDialog
            open={dialog === "delete"}
            onOpenChange={close}
            title={`Delete ${current.name}?`}
            description={
              <>
                This permanently deletes the environment and its <strong>{current.var_count} variables</strong> across
                all services. Services themselves are kept. This cannot be undone.
              </>
            }
            confirmPhrase={current.name}
            actionLabel="Delete environment"
            onConfirm={async () => {
              const res = await deleteEnvironment(current.id);
              if (!res.ok) {
                toast.error(res.error);
                return false;
              }
              toast.success(`Environment "${current.name}" deleted`);
              router.push("/env-pack");
              return true;
            }}
          />
        </>
      )}
    </div>
  );
}
