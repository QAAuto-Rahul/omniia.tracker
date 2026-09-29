import "server-only";
import { col } from "@/lib/server/mongo";

export const CHECK_INTERVAL_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;

type CheckTarget = { _id: number; url: string; expected_status: number; expect_text: string };

export type ProbeResult = {
  ok: boolean;
  status_code: number | null;
  latency_ms: number;
  error: string | null;
  snippet: string | null;
};

export async function probe(check: Omit<CheckTarget, "_id">): Promise<ProbeResult> {
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  try {
    const res = await fetch(check.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "OmniiaTracker-Health/1.0", accept: "application/json, text/plain, */*" },
    });
    const body = (await res.text()).slice(0, 4000);
    const latency_ms = elapsed();
    const snippet = body.slice(0, 300);
    const result = (ok: boolean, error: string | null): ProbeResult => ({
      ok,
      status_code: res.status,
      latency_ms,
      error,
      snippet,
    });

    if (res.status !== check.expected_status) return result(false, `Expected HTTP ${check.expected_status}, got ${res.status}`);
    if (check.expect_text && !body.includes(check.expect_text)) {
      return result(false, `Response does not contain "${check.expect_text}"`);
    }
    try {
      const json = JSON.parse(body);
      if (json && typeof json === "object" && json.success === false) return result(false, 'Response has "success": false');
    } catch {
      // Not JSON - status (and expected text) decide.
    }
    return result(true, null);
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const error =
      e.name === "TimeoutError" || e.name === "AbortError"
        ? `Timed out after ${TIMEOUT_MS / 1000}s`
        : e.cause?.code
          ? `${e.cause.code}${e.cause.message ? `: ${e.cause.message}` : ""}`
          : e.message;
    return { ok: false, status_code: null, latency_ms: elapsed(), error, snippet: null };
  }
}

async function saveResult(checkId: number, r: ProbeResult) {
  await (await col("health_results")).insertOne({ check_id: checkId, ...r, checked_at: new Date() });
}

export async function runCheck(checkId: number): Promise<ProbeResult | null> {
  const check = await (await col("health_checks")).findOne({ _id: checkId });
  if (!check) return null;
  const result = await probe(check);
  await saveResult(check._id, result);
  return result;
}

export async function runAllChecks(ids?: number[]): Promise<number> {
  const checks: CheckTarget[] = await (await col("health_checks"))
    .find(ids ? { _id: { $in: ids } } : { enabled: true })
    .toArray();
  let next = 0;
  const worker = async () => {
    while (next < checks.length) {
      const check = checks[next++];
      await saveResult(check._id, await probe(check));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, checks.length) }, worker));
  return checks.length;
}

export function startMonitor() {
  const g = globalThis as unknown as { omniiaMonitor?: NodeJS.Timeout };
  if (g.omniiaMonitor) return;

  let running = false;
  const tick = async () => {
    if (running) return; // previous round still going
    running = true;
    try {
      await runAllChecks();
    } catch (err) {
      console.error("[health] check round failed:", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };

  g.omniiaMonitor = setInterval(tick, CHECK_INTERVAL_MS);
  g.omniiaMonitor.unref?.();
  setTimeout(tick, 5_000);
  console.log(`[health] monitor started - checking every ${CHECK_INTERVAL_MS / 1000}s`);
}
