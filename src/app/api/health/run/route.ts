import { NextResponse } from "next/server";
import { runAllChecks } from "@/lib/status/monitor";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await runAllChecks();
  return NextResponse.json({ checked: count });
}
