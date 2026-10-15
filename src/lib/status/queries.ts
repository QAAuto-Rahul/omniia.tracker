import "server-only";
import { requireUser } from "@/lib/server/dal";
import { CI, col } from "@/lib/server/mongo";
import { CHECK_INTERVAL_MS } from "./monitor";
import type { HealthCheck, StatusBoard } from "./types";

const RECENT = 30;

export async function getStatusBoard(): Promise<StatusBoard> {
  await requireUser();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [environments, services, checks, uptime, recentByCheck] = await Promise.all([
    (await col("environments")).find({}, { projection: { name: 1 } }).sort({ _id: 1 }).toArray(),
    (await col("services")).find({}, { projection: { name: 1 } }).sort({ name: 1 }).collation(CI).toArray(),
    (await col("health_checks")).find().toArray(),
    (await col("health_results"))
      .aggregate<{ _id: number; up: number; total: number }>([
        { $match: { checked_at: { $gt: since } } },
        { $group: { _id: "$check_id", up: { $sum: { $cond: ["$ok", 1, 0] } }, total: { $sum: 1 } } },
      ])
      .toArray(),
    (await col("health_results"))
      .aggregate<{
        _id: number;
        recent: {
          ok: boolean;
          status_code: number | null;
          latency_ms: number;
          error: string | null;
          snippet: string | null;
          checked_at: Date;
        }[];
      }>([
        { $sort: { check_id: 1, checked_at: -1 } },
        {
          $group: {
            _id: "$check_id",
            recent: {
              $firstN: {
                n: RECENT,
                input: {
                  ok: "$ok",
                  status_code: "$status_code",
                  latency_ms: "$latency_ms",
                  error: "$error",
                  snippet: "$snippet",
                  checked_at: "$checked_at",
                },
              },
            },
          },
        },
      ])
      .toArray(),
  ]);

  const uptimeBy = new Map(uptime.map((u) => [u._id, Math.round((u.up / u.total) * 1000) / 10]));
  const recentBy = new Map(recentByCheck.map((r) => [r._id, r.recent.slice().reverse()]));

  const board: HealthCheck[] = checks.map((c) => {
    const recent = recentBy.get(c._id) ?? [];
    const lastRow = recent.at(-1);
    const last = lastRow ? { ...lastRow, checked_at: lastRow.checked_at.getTime() } : null;
    return {
      id: c._id,
      service_id: c.service_id,
      environment_id: c.environment_id,
      url: c.url,
      expected_status: c.expected_status,
      expect_text: c.expect_text,
      enabled: c.enabled,
      deployed: c.deployed !== false,
      state: c.deployed === false ? "not_deployed" : !c.enabled ? "paused" : !last ? "pending" : last.ok ? "up" : "down",
      last,
      uptime_24h: uptimeBy.get(c._id) ?? null,
      recent: recent.map((r) => ({ ok: r.ok, latency_ms: r.latency_ms, checked_at: r.checked_at.getTime() })),
    };
  });

  return {
    environments: environments.map((e) => ({ id: e._id, name: e.name })),
    services: services.map((s) => ({ id: s._id, name: s.name })),
    checks: board,
    intervalSeconds: CHECK_INTERVAL_MS / 1000,
  };
}
