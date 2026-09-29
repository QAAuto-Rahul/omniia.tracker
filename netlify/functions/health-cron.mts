import type { Config } from "@netlify/functions";

// Runs every 2 minutes (matches CHECK_INTERVAL_MS) and triggers a check round.
export default async () => {
  const res = await fetch(`${process.env.URL}/api/health/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log("[health-cron]", res.status, await res.text());
};

export const config: Config = { schedule: "*/2 * * * *" };
