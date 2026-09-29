"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ClipboardCopy,
  Copy,
  CopyPlus,
  Download,
  FileUp,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDialogTarget } from "@/hooks/use-dialog-target";
import { createVar, deleteVar, updateVar } from "@/lib/envpack/actions";
import { serializeDotenv } from "@/lib/envpack/dotenv";
import type { EnvVar } from "@/lib/envpack/types";
import { KEY_RE } from "@/lib/envpack/validation";
import { copyToClipboard, formatDateTime, shortEmail, timeAgo } from "@/lib/format";
import { ConfirmDialog } from "./confirm-dialog";
import { CopyFromEnvDialog } from "./copy-from-env-dialog";
import { EnvDot } from "./env-badge";
import { ImportDialog } from "./import-dialog";

type EnvCount = { id: number; name: string; var_count: number };

type Props = {
  serviceId: number;
  serviceName: string;
  environment: { id: number; name: string };
  vars: EnvVar[];
  /** Variable counts for this service in every environment. */
  envCounts: EnvCount[];
};

const keyError = (key: string) =>
  !key ? "Key is required." : KEY_RE.test(key) ? null : 'Use letters, digits, "_", "." or "-", starting with a letter or "_".';

/** Ctrl/Cmd+Enter submits, Escape cancels. */
function handleEditorKeys(e: React.KeyboardEvent, onSubmit: () => void, onCancel?: () => void) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    onSubmit();
  } else if (e.key === "Escape" && onCancel) {
    e.preventDefault();
    onCancel();
  }
}

async function copy(text: string, label: string) {
  if (await copyToClipboard(text)) toast.success(`${label} copied`);
  else toast.error("Could not copy to clipboard");
}

export function VarsTable({ serviceId, serviceName, environment, vars, envCounts }: Props) {
  const environmentName = environment.name;
  const copySources = envCounts.filter((e) => e.id !== environment.id && e.var_count > 0);
  const copyFrom = useDialogTarget<EnvCount>();
  const [filter, setFilter] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editing, setEditing] = useState<{ id: number; key: string; value: string } | null>(null);
  const deleting = useDialogTarget<EnvVar>();
  const [importOpen, setImportOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const newKeyRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return vars;
    return vars.filter((v) => v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q));
  }, [vars, filter]);

  const existingKeys = useMemo(() => new Set(vars.map((v) => v.key)), [vars]);

  function addVar(e?: React.FormEvent) {
    e?.preventDefault();
    const key = newKey.trim();
    const err = keyError(key);
    if (err) return toast.error(err);
    startTransition(async () => {
      const res = await createVar(serviceId, environment.id, { key, value: newValue });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${key} added`);
      setNewKey("");
      setNewValue("");
      newKeyRef.current?.focus();
    });
  }

  function saveEdit() {
    if (!editing) return;
    const key = editing.key.trim();
    const err = keyError(key);
    if (err) return toast.error(err);
    startTransition(async () => {
      const res = await updateVar(editing.id, { key, value: editing.value });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${key} updated`);
      setEditing(null);
    });
  }

  function exportFile() {
    const blob = new Blob([serializeDotenv(vars) + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${serviceName}.${environmentName}.env`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="mr-auto flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="font-medium">Variables</h2>
          <span className="rounded-md bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
            {filter ? `${filtered.length} / ${vars.length}` : vars.length}
          </span>
        </div>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter keys or values…"
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp /> Import .env
        </Button>
        {copySources.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <CopyPlus /> Copy from
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {copySources.map((env) => (
                <DropdownMenuItem key={env.id} onClick={() => copyFrom.show(env)}>
                  <EnvDot name={env.name} />
                  <span className="flex-1">{env.name}</span>
                  <span className="text-xs text-muted-foreground">{env.var_count} vars</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={vars.length === 0} />}>
            <Download /> Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => copy(serializeDotenv(vars), ".env content")}>
              <ClipboardCopy /> Copy as .env
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportFile}>
              <Download /> Download .env
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add row */}
      <form
        onSubmit={addVar}
        className="grid gap-2 border-b bg-muted/30 p-3 md:grid-cols-[minmax(200px,28%)_1fr_auto] md:items-start"
      >
        <Input
          ref={newKeyRef}
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="KEY_NAME"
          spellCheck={false}
          autoComplete="off"
          className="bg-background font-mono"
          disabled={pending}
          aria-label="New variable key"
        />
        <Textarea
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => handleEditorKeys(e, addVar)}
          placeholder="value  (Ctrl+Enter to add)"
          spellCheck={false}
          rows={1}
          className="min-h-8 bg-background py-1.5 font-mono md:text-sm"
          disabled={pending}
          aria-label="New variable value"
        />
        <Button type="submit" disabled={pending || !newKey.trim()}>
          {pending && !editing ? <Loader2 className="animate-spin" /> : <Plus />}
          Add variable
        </Button>
      </form>

      {/* List */}
      {vars.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div>
            <p className="font-medium">No variables in {environmentName} yet</p>
            <p className="text-sm text-muted-foreground">
              Add them one by one above, use <strong>Import .env</strong> to paste a whole file
              {copySources.length > 0 && ", or copy them from another environment"}.
            </p>
          </div>
          {copySources.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {copySources.map((env) => (
                <Button key={env.id} variant="outline" size="sm" onClick={() => copyFrom.show(env)}>
                  <EnvDot name={env.name} />
                  Copy from {env.name} ({env.var_count})
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">No variables match &ldquo;{filter}&rdquo;.</p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[28%] pl-4">Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="hidden w-40 lg:table-cell">Last updated</TableHead>
              <TableHead className="w-28 pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) =>
              editing?.id === v.id ? (
                <TableRow key={v.id} className="bg-muted/40 hover:bg-muted/40">
                  <TableCell className="pl-4 align-top whitespace-normal">
                    <Input
                      autoFocus
                      value={editing.key}
                      onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                      onKeyDown={(e) => handleEditorKeys(e, saveEdit, () => setEditing(null))}
                      spellCheck={false}
                      className="bg-background font-mono"
                      disabled={pending}
                      aria-label="Key"
                    />
                  </TableCell>
                  <TableCell className="align-top whitespace-normal" colSpan={2}>
                    <Textarea
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={(e) => handleEditorKeys(e, saveEdit, () => setEditing(null))}
                      spellCheck={false}
                      rows={1}
                      className="min-h-8 bg-background py-1.5 font-mono md:text-sm"
                      disabled={pending}
                      aria-label="Value"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Ctrl+Enter to save · Esc to cancel</p>
                  </TableCell>
                  <TableCell className="pr-4 text-right align-top">
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" onClick={saveEdit} disabled={pending} aria-label="Save">
                        {pending ? <Loader2 className="animate-spin" /> : <Check />}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                        disabled={pending}
                        aria-label="Cancel"
                      >
                        <X />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={v.id} className="group">
                  <TableCell className="pl-4 align-top whitespace-normal">
                    <span className="font-mono text-[13px] font-medium break-all">{v.key}</span>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    {v.value === "" ? (
                      <span className="text-xs text-muted-foreground italic">empty</span>
                    ) : (
                      <span className="block font-mono text-[13px] break-all whitespace-pre-wrap">{v.value}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden align-top text-xs text-muted-foreground lg:table-cell">
                    <span title={formatDateTime(v.updated_at)} suppressHydrationWarning>
                      {timeAgo(v.updated_at)}
                    </span>
                    <span className="block truncate" title={v.updated_by ?? undefined}>
                      by {shortEmail(v.updated_by)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right align-top">
                    <div className="flex justify-end gap-0.5">
                      <RowAction label="Copy value" onClick={() => copy(v.value, v.key)}>
                        <Copy />
                      </RowAction>
                      <RowAction
                        label="Edit"
                        onClick={() => setEditing({ id: v.id, key: v.key, value: v.value })}
                        disabled={pending}
                      >
                        <Pencil />
                      </RowAction>
                      <RowAction label="Delete" onClick={() => deleting.show(v)} disabled={pending} destructive>
                        <Trash2 />
                      </RowAction>
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        serviceId={serviceId}
        serviceName={serviceName}
        environment={environment}
        existingKeys={existingKeys}
      />
      <CopyFromEnvDialog
        open={copyFrom.open}
        onOpenChange={copyFrom.onOpenChange}
        serviceId={serviceId}
        serviceName={serviceName}
        source={copyFrom.target}
        target={environment}
      />
      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.onOpenChange}
        title={`Delete ${deleting.target?.key}?`}
        description={`This removes the variable from ${serviceName} in ${environmentName}.`}
        onConfirm={async () => {
          const target = deleting.target;
          if (!target) return true;
          const res = await deleteVar(target.id);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`${target.key} deleted`);
          return true;
        }}
      />
    </section>
  );
}

function RowAction({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={destructive ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground"}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
