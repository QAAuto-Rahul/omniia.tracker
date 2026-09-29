export async function register() {
  // Serverless hosts (Netlify/Lambda) freeze the process between requests, so an
  // in-process interval fires late and records false timeouts. There, the
  // scheduled function in netlify/functions/health-cron.mts drives checks instead.
  const serverless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.NEXT_RUNTIME === "nodejs" && !serverless && process.env.HEALTH_MONITOR !== "off") {
    const { startMonitor } = await import("@/lib/status/monitor");
    startMonitor();
  }
}
