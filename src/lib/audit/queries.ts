import "server-only";
import { requireUser } from "@/lib/server/dal";
import { col, iso } from "@/lib/server/mongo";

export type AuditEntry = {
  id: string;
  user_email: string;
  action: string;
  entity: string;
  entity_id: number | null;
  detail: string | null;
  created_at: string;
};

export const AUDIT_LIMIT = 500;

export async function getAuditLog(): Promise<AuditEntry[]> {
  await requireUser();
  const rows = await (await col("audit_log")).find().sort({ created_at: -1 }).limit(AUDIT_LIMIT).toArray();
  return rows.map((r) => ({
    id: String(r._id),
    user_email: r.user_email,
    action: r.action,
    entity: r.entity,
    entity_id: r.entity_id,
    detail: r.detail,
    created_at: iso(r.created_at),
  }));
}
