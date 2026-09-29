"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { importVars } from "@/lib/envpack/actions";
import { parseDotenv } from "@/lib/envpack/dotenv";
import { KEY_RE } from "@/lib/envpack/validation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  serviceName: string;
  environment: { id: number; name: string };
  existingKeys: Set<string>;
};

export function ImportDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <ImportForm {...rest} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({
  serviceId,
  serviceName,
  environment,
  existingKeys,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(true);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => {
    const { entries, errors } = parseDotenv(text);
    const invalid = entries.filter((e) => !KEY_RE.test(e.key)).map((e) => `Invalid key "${e.key}"`);
    const valid = entries.filter((e) => KEY_RE.test(e.key));
    const conflicts = valid.filter((e) => existingKeys.has(e.key)).length;
    return { valid, problems: [...errors, ...invalid], conflicts };
  }, [text, existingKeys]);

  function onImport() {
    startTransition(async () => {
      const res = await importVars(serviceId, environment.id, parsed.valid, overwrite);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Imported into ${serviceName} (${environment.name})`, {
        description: `${res.created} added · ${res.updated} updated · ${res.skipped} unchanged`,
      });
      onDone();
    });
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Import .env into {environment.name}</DialogTitle>
        <DialogDescription>Paste the contents of a .env file. Comments and blank lines are ignored.</DialogDescription>
      </DialogHeader>

      <Textarea
        autoFocus
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"DATABASE_URL=postgres://user:pass@host:5432/db\nREDIS_HOST=redis.internal\n# comments are ignored"}
        className="max-h-[50vh] min-h-48 font-mono text-xs md:text-xs"
        disabled={pending}
      />

      <div className="grid gap-2 text-sm">
        <p>
          <span className="font-medium">{parsed.valid.length}</span> variable{parsed.valid.length === 1 ? "" : "s"}{" "}
          detected
          {parsed.conflicts > 0 && (
            <span className="text-muted-foreground"> · {parsed.conflicts} already exist in this environment</span>
          )}
        </p>
        {parsed.problems.length > 0 && (
          <ul className="list-inside list-disc text-xs text-destructive">
            {parsed.problems.slice(0, 5).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {parsed.problems.length > 5 && <li>…and {parsed.problems.length - 5} more (skipped)</li>}
          </ul>
        )}
        {parsed.conflicts > 0 && (
          <label className="flex items-center gap-2.5">
            <Checkbox checked={overwrite} onCheckedChange={(c) => setOverwrite(c === true)} disabled={pending} />
            Overwrite existing values
          </label>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
        <Button onClick={onImport} disabled={pending || parsed.valid.length === 0}>
          {pending && <Loader2 className="animate-spin" />}
          Import {parsed.valid.length || ""}
        </Button>
      </DialogFooter>
    </div>
  );
}
