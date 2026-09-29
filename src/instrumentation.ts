export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.HEALTH_MONITOR !== "off") {
    const { startMonitor } = await import("@/lib/status/monitor");
    startMonitor();
  }
}
