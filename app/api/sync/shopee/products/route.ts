import { NextResponse } from "next/server";
import { dataMode } from "@/src/lib/server/db";
import { syncShopeeProducts } from "@/src/lib/server/shopee-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (dataMode() !== "database") return NextResponse.json({ ok: false, error: "Database mode is required for product sync" }, { status: 503 });
  try {
    const body = await request.json().catch(() => ({})) as { shopId?: string };
    const result = await syncShopeeProducts(body.shopId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Shopee product sync failed" }, { status: 502 });
  }
}

