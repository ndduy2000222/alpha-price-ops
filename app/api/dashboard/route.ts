import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/src/lib/server/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getDashboardSnapshot());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dashboard data failed" }, { status: 500 });
  }
}
