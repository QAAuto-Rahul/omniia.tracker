export type CheckState = "up" | "down" | "pending" | "paused" | "not_deployed";

export type HealthCheck = {
  id: number;
  service_id: number;
  environment_id: number;
  url: string;
  expected_status: number;
  expect_text: string;
  enabled: boolean;
  deployed?: boolean;
  state: CheckState;
  last: {
    ok: boolean;
    status_code: number | null;
    latency_ms: number | null;
    error: string | null;
    snippet: string | null;
    checked_at: number;
  } | null;
  /** % of successful checks in the last 24h, null if none yet. */
  uptime_24h: number | null;
  /** Most recent results, oldest first. */
  recent: { ok: boolean; latency_ms: number | null; checked_at: number }[];
};

export type StatusBoard = {
  environments: { id: number; name: string }[];
  services: { id: number; name: string }[];
  checks: HealthCheck[];
  intervalSeconds: number;
};
