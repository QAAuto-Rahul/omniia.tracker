"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileSpreadsheet, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteDocument, saveDocument } from "@/lib/documents/actions";

export type SavedDocument = { id: number; name: string; description: string; url: string; kind: "excel" | "document"; updated_at: string };

function previewUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("docs.google.com") && !url.pathname.includes("/preview")) return `${url.toString().replace(/\/$/, "")}/preview`;
    return value;
  } catch { return value; }
}

export function DocumentsPanel({ initialDocuments }: { initialDocuments: SavedDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selected, setSelected] = useState<SavedDocument | null>(null);
  const [editing, setEditing] = useState<SavedDocument | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const record = {
      ...(editing ? { id: editing.id } : {}),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      url: String(formData.get("url") ?? ""),
      kind: String(formData.get("kind") ?? "document") as "excel" | "document",
    };
    startTransition(async () => {
      const result = await saveDocument(record);
      if (!result.ok) { toast.error(result.error); return; }
      const saved = { ...record, id: result.id!, updated_at: new Date().toISOString() };
      setDocuments((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setFormOpen(false); setEditing(null); toast.success(editing ? "Document updated." : "Document link saved.");
    });
  }

  function remove(doc: SavedDocument) {
    if (!window.confirm(`Remove “${doc.name}” from your saved links?`)) return;
    startTransition(async () => {
      const result = await deleteDocument(doc.id);
      if (!result.ok) { toast.error(result.error); return; }
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      if (selected?.id === doc.id) setSelected(null);
      toast.success("Document link removed.");
    });
  }

  function openEditor(doc?: SavedDocument) { setEditing(doc ?? null); setFormOpen(true); }

  return (
    <div className="space-y-3">
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium text-muted-foreground">Saved links ({documents.length})</h2><Button size="sm" onClick={() => openEditor()}><Plus /> Add link</Button></div>
        {documents.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No links saved yet. Add an Excel sheet or document to get started.</CardContent></Card> : documents.map((doc) => {
          const Icon = doc.kind === "excel" ? FileSpreadsheet : FileText;
          return <Card key={doc.id}>
            <CardContent className="flex items-start gap-3 p-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(doc)}><span className="block truncate text-sm font-medium">{doc.name}</span><span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{doc.description || doc.url}</span><span className="mt-2 block truncate text-xs text-muted-foreground">{doc.kind === "excel" ? "Excel" : "Document"} · {new URL(doc.url).hostname}</span></button>
              <div className="flex shrink-0"><Button variant="ghost" size="icon-sm" aria-label="Edit link" onClick={() => openEditor(doc)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="Remove link" disabled={pending} onClick={() => remove(doc)}><Trash2 /></Button></div>
            </CardContent>
          </Card>;
        })}
      </section>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="h-[90svh] max-h-[900px] w-[calc(100%-2rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)] gap-3">
          {selected && <>
            <DialogHeader className="pr-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DialogTitle className="truncate">{selected.name}</DialogTitle>
                <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Open in new tab <ExternalLink className="size-4" /></a>
              </div>
              <DialogDescription>{selected.description || "No description provided."}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0">
              <iframe key={selected.id} title={`Preview of ${selected.name}`} src={previewUrl(selected.url)} className="size-full rounded-md border bg-background" referrerPolicy="no-referrer" />
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent><form action={submit} className="contents">
          <DialogHeader><DialogTitle>{editing ? "Edit document link" : "Add document link"}</DialogTitle><DialogDescription>Save a link to a spreadsheet or document for your team.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="doc-name">Name</Label><Input id="doc-name" name="name" required maxLength={80} defaultValue={editing?.name} placeholder="e.g. Release checklist" /></div>
            <div className="space-y-2"><Label htmlFor="doc-url">Document link</Label><Input id="doc-url" name="url" type="url" required defaultValue={editing?.url} placeholder="https://..." /></div>
            <div className="space-y-2"><Label htmlFor="doc-kind">Type</Label><select id="doc-kind" name="kind" defaultValue={editing?.kind ?? "document"} className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"><option value="excel">Excel spreadsheet</option><option value="document">Document</option></select></div>
            <div className="space-y-2"><Label htmlFor="doc-description">Description</Label><Textarea id="doc-description" name="description" maxLength={500} defaultValue={editing?.description} placeholder="What is this file for?" /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save link"}</Button></DialogFooter>
        </form></DialogContent>
      </Dialog>
    </div>
  );
}
