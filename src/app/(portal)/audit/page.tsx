import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { AUDIT_LIMIT, getAuditLog } from "@/lib/audit/queries";
import { formatDateTime, shortEmail, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Audit Log" };

const ENTITY_LABEL: Record<string, string> = {
  environment: "Environment",
  service: "Service",
  env_var: "Variable",
  health_check: "Health check",
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  delete: "destructive",
};

export default async function AuditPage() {
  const entries = await getAuditLog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Who changed what, newest first. Showing the last {AUDIT_LIMIT} changes.
        </p>
      </div>

      <div className="max-h-[calc(100svh-12rem)] overflow-y-auto rounded-xl border">
        {entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium" title={e.user_email}>
                  {shortEmail(e.user_email)}
                </span>
                <Badge variant={ACTION_VARIANT[e.action] ?? "secondary"}>{e.action}</Badge>
                <span className="text-muted-foreground">
                  {ENTITY_LABEL[e.entity] ?? e.entity}
                  {e.entity_id !== null && ` #${e.entity_id}`}
                </span>
                {e.detail && <span className="min-w-0 flex-1 truncate font-mono text-xs">{e.detail}</span>}
                <time
                  dateTime={e.created_at}
                  title={formatDateTime(e.created_at)}
                  className="ml-auto shrink-0 text-xs text-muted-foreground"
                >
                  {timeAgo(e.created_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
