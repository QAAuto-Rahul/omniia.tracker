"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { addChecksFromPattern } from "@/lib/status/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environments: { id: number; name: string }[];
  /** Services without a check, per environment id. */
  missing: Record<number, string[]>;
};

export function PatternDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <PatternForm {...rest} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PatternForm({ environments, missing, onDone }: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const [envId, setEnvId] = useState(String(environments[0]?.id ?? ""));
  const [pattern, setPattern] = useState("https://{service}.testsdlc.in/");
  const [expectText, setExpectText] = useState("");
  const [pending, startTransition] = useTransition();

  const env = environments.find((e) => String(e.id) === envId);
  const toAdd = env ? (missing[env.id] ?? []) : [];
  const preview = toAdd[0]
    ? pattern.replaceAll("{service}", toAdd[0]).replaceAll("{env}", env!.name.toLowerCase())
    : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!env) return;
    startTransition(async () => {
      const res = await addChecksFromPattern(env.id, pattern, expectText);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added ${res.added} health checks to ${env.name}`);
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add checks from a URL pattern</DialogTitle>
        <DialogDescription>
          Creates a check for every service that doesn&apos;t have one in the chosen environment. Use{" "}
          <code className="font-mono">{"{service}"}</code> for the service name and{" "}
          <code className="font-mono">{"{env}"}</code> for the environment name.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label>Environment</Label>
        <Select
          items={environments.map((e) => ({ value: String(e.id), label: e.name }))}
          value={envId}
          onValueChange={(v) => v && setEnvId(v)}
        >
          <SelectTrigger className="w-full" disabled={pending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {environments.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.name} ({missing[e.id]?.length ?? 0} without a check)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="pattern">URL pattern</Label>
        <Input
          id="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="font-mono"
          disabled={pending}
        />
        {preview && (
          <p className="text-xs text-muted-foreground">
            e.g. <span className="font-mono">{preview}</span>
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="pattern-text">
          Must contain <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="pattern-text"
          value={expectText}
          onChange={(e) => setExpectText(e.target.value)}
          placeholder="Hello world"
          disabled={pending}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending || toAdd.length === 0 || !pattern.includes("{service}")}>
          {pending && <Loader2 className="animate-spin" />}
          Add {toAdd.length} check{toAdd.length === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </form>
  );
}
