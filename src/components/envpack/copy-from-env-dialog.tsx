"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import { copyVarsFromEnvironment } from "@/lib/envpack/actions";
import { EnvBadge } from "./env-badge";

type EnvRef = { id: number; name: string; var_count: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  serviceName: string;
  source: EnvRef | null;
  target: { id: number; name: string };
};

export function CopyFromEnvDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {rest.source && <CopyForm {...rest} source={rest.source} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CopyForm({
  serviceId,
  serviceName,
  source,
  target,
  onDone,
}: Omit<Props, "open" | "onOpenChange" | "source"> & { source: EnvRef; onDone: () => void }) {
  // Keys only by default, so production secrets aren't copied somewhere by accident.
  const [includeValues, setIncludeValues] = useState(false);
  const [pending, startTransition] = useTransition();

  function onCopy() {
    startTransition(async () => {
      const res = await copyVarsFromEnvironment(serviceId, source.id, target.id, includeValues);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Copied into ${target.name}`, {
        description: `${res.created} added · ${res.skipped} already existed (kept)`,
      });
      onDone();
    });
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Copy variables</DialogTitle>
        <DialogDescription>
          Copy {source.var_count} variable{source.var_count === 1 ? "" : "s"} of <strong>{serviceName}</strong> into
          this environment. Keys that already exist here are kept as they are.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 text-sm">
        <EnvBadge name={source.name} />
        <span className="text-muted-foreground">→</span>
        <EnvBadge name={target.name} />
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox
          checked={includeValues}
          onCheckedChange={(c) => setIncludeValues(c === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <span>
          Copy values too
          <span className="block text-xs text-muted-foreground">
            Otherwise only the keys are copied, with empty values to fill in for {target.name}.
          </span>
        </span>
      </label>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button onClick={onCopy} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Copy {includeValues ? "keys & values" : "keys"}
        </Button>
      </DialogFooter>
    </div>
  );
}
