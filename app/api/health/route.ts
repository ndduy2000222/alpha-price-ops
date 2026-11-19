import { NextResponse } from "next/server";
import { databaseHealth } from "@/src/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseHealth();
  return NextResponse.json({
    ok: database.healthy,
    service: "alpha-price-ops",
    environment: process.env.VERCEL_ENV ?? "development",
    timezone: process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh",
    database,
    timestamp: new Date().toISOString(),
  }, { status: database.healthy ? 200 : 503 });
}
