"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/dal";
import { audit, col, isDuplicateKey, nextId } from "@/lib/server/mongo";
import { ValidationError, validateDescription, validateName } from "@/lib/envpack/validation";

export type DocumentResult = { ok: true; id?: number } | { ok: false; error: string };

function validateUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new ValidationError("Enter a valid http or https link.");
  }
}

async function run(fn: (email: string) => Promise<number | void>): Promise<DocumentResult> {
  const user = await requireUser();
  try {
    const id = await fn(user.email);
    revalidatePath("/documents");
    revalidatePath("/audit");
    return { ok: true, ...(typeof id === "number" ? { id } : {}) };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: err.message };
    if (isDuplicateKey(err)) return { ok: false, error: "A document with that name already exists." };
    console.error("[documents]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function saveDocument(input: { id?: number; name: string; description: string; url: string; kind: "excel" | "document" }): Promise<DocumentResult> {
  return run(async (email) => {
    const name = validateName(input.name, "Name");
    const description = validateDescription(input.description);
    const url = validateUrl(input.url);
    if (input.kind !== "excel" && input.kind !== "document") throw new ValidationError("Choose Excel or Document.");
    const docs = await col("documents");
    const now = new Date();
    if (input.id !== undefined) {
      const id = Number(input.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError("Invalid document.");
      const result = await docs.updateOne({ _id: id }, { $set: { name, description, url, kind: input.kind, updated_at: now } });
      if (!result.matchedCount) throw new ValidationError("Document not found. Refresh the page and try again.");
      await audit(email, "update", "document", id, name);
      return id;
    }
    const id = await nextId("documents");
    await docs.insertOne({ _id: id, name, description, url, kind: input.kind, created_by: email, created_at: now, updated_at: now });
    await audit(email, "create", "document", id, name);
    return id;
  });
}

export async function deleteDocument(inputId: number): Promise<DocumentResult> {
  return run(async (email) => {
    const id = Number(inputId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError("Invalid document.");
    const doc = await (await col("documents")).findOneAndDelete({ _id: id });
    if (!doc) throw new ValidationError("Document not found.");
    await audit(email, "delete", "document", id, doc.name);
  });
}
