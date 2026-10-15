import "server-only";
import { requireUser } from "@/lib/server/dal";
import { col, iso } from "@/lib/server/mongo";

export async function getDocuments() {
  await requireUser();
  const rows = await (await col("documents")).find().sort({ updated_at: -1 }).toArray();
  return rows.map((d) => ({ id: d._id, name: d.name, description: d.description, url: d.url, kind: d.kind, updated_at: iso(d.updated_at) }));
}
