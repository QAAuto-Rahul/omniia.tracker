"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteService } from "@/lib/envpack/actions";
import type { ServiceDetail } from "@/lib/envpack/types";
import { ConfirmDialog } from "./confirm-dialog";
import { EnvBadge } from "./env-badge";
import { ServiceDialog } from "./service-dialog";

export function ServiceHeader({ detail }: { detail: ServiceDetail }) {
  const router = useRouter();
  const { service, environment, envCounts } = detail;
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const close = (open: boolean) => !open && setDialog(null);
  const totalVars = envCounts.reduce((sum, e) => sum + e.var_count, 0);

  return (
    <div className="flex min-w-0 items-start gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-foreground/10">
        <Server className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{service.name}</h1>
          <EnvBadge name={environment.name} />
        </div>
        <p className="text-sm text-muted-foreground">{service.description || "No description"}</p>
        <div className="mt-2 flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setDialog("edit")}>
            <Pencil /> Edit service
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDialog("delete")}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <ServiceDialog open={dialog === "edit"} onOpenChange={close} environmentId={environment.id} service={service} />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Delete ${service.name}?`}
        description={
          <>
            This deletes the service from <strong>every environment</strong>, including its{" "}
            <strong>{totalVars} variables</strong>. This cannot be undone.
          </>
        }
        confirmPhrase={totalVars > 0 ? service.name : undefined}
        actionLabel="Delete service"
        onConfirm={async () => {
          const res = await deleteService(service.id);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`Service "${service.name}" deleted`);
          router.push(`/env-pack/${environment.id}`);
          return true;
        }}
      />
    </div>
  );
}
