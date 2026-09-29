"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createEnvironment, updateEnvironment } from "@/lib/envpack/actions";
import type { Environment } from "@/lib/envpack/types";
import { DESCRIPTION_MAX, NAME_MAX } from "@/lib/envpack/validation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this environment; omit to create a new one. */
  environment?: Environment;
  environments: Environment[];
};

export function EnvironmentDialog({ open, onOpenChange, environment, environments }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Content unmounts on close, so the form state resets every time it opens. */}
        <EnvironmentForm environment={environment} environments={environments} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EnvironmentForm({
  environment,
  environments,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const router = useRouter();
  const isEdit = !!environment;
  const [name, setName] = useState(environment?.name ?? "");
  const [description, setDescription] = useState(environment?.description ?? "");
  const [cloneFrom, setCloneFrom] = useState("none");
  const [includeValues, setIncludeValues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cloneItems = [
    { value: "none", label: "Start empty" },
    ...environments.map((e) => ({ value: String(e.id), label: `${e.name} (${e.var_count} variables)` })),
  ];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (environment) {
        const res = await updateEnvironment(environment.id, { name, description });
        if (!res.ok) return setError(res.error);
        toast.success("Environment updated");
        onDone();
        return;
      }

      const res = await createEnvironment({
        name,
        description,
        cloneFromId: cloneFrom === "none" ? null : Number(cloneFrom),
        includeValues,
      });
      if (!res.ok) return setError(res.error);
      toast.success(`Environment "${name.trim()}" created`);
      onDone();
      router.push(`/env-pack/${res.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit environment" : "New environment"}</DialogTitle>
        <DialogDescription>
          {isEdit ? "Rename or describe this environment." : "e.g. Development, QA, Staging, Production."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="env-name">Name</Label>
        <Input
          id="env-name"
          autoFocus
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Production"
          disabled={pending}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="env-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="env-description"
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Live customer-facing environment"
          disabled={pending}
        />
      </div>

      {!isEdit && environments.length > 0 && (
        <div className="grid gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="grid gap-2">
            <Label>Copy variables from</Label>
            <Select items={cloneItems} value={cloneFrom} onValueChange={(v) => setCloneFrom(v ?? "none")}>
              <SelectTrigger className="w-full bg-background" disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cloneItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cloneFrom !== "none" && (
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={includeValues}
                onCheckedChange={(checked) => setIncludeValues(checked === true)}
                disabled={pending}
                className="mt-0.5"
              />
              <span>
                Copy values too
                <span className="block text-xs text-muted-foreground">
                  Otherwise only the keys are copied, with empty values to fill in.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Create environment"}
        </Button>
      </DialogFooter>
    </form>
  );
}
