import { NextResponse } from "next/server";
import { exchangeAuthorizationCode, getShopInfo, persistShopeeConnection } from "@/src/lib/server/shopee";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.json({ ok: false, error: "Shopee authorization was declined" }, { status: 400 });

  const code = url.searchParams.get("code");
  const shopIdValue = url.searchParams.get("shop_id");
  const mainAccountIdValue = url.searchParams.get("main_account_id");
  const shopId = shopIdValue ? Number(shopIdValue) : undefined;
  const mainAccountId = mainAccountIdValue ? Number(mainAccountIdValue) : undefined;
  if (!code || (!shopId && !mainAccountId)) {
    return NextResponse.json({ ok: false, error: "Shopee callback is missing code and shop identity" }, { status: 400 });
  }

  try {
    const token = await exchangeAuthorizationCode({ code, shopId, mainAccountId });
    const shopIds = token.shopIds.length > 0 ? token.shopIds : shopId ? [shopId] : [];
    if (shopIds.length === 0) throw new Error("Shopee did not return an authorized shop");
    for (const authorizedShopId of shopIds) {
      const info = await getShopInfo({ accessToken: token.accessToken, shopId: authorizedShopId });
      await persistShopeeConnection({ shopId: authorizedShopId, shopName: info.name, shopLogo: info.logo, accessToken: token.accessToken, refreshToken: token.refreshToken, expireIn: token.expireIn, requestId: token.requestId ?? info.requestId });
    }
    return NextResponse.json({ ok: true, provider: "shopee", connectedShops: shopIds.length, message: "Shopee connection authorized and stored" });
  } catch (callbackError) {
    return NextResponse.json({ ok: false, error: callbackError instanceof Error ? callbackError.message : "Shopee authorization failed" }, { status: 502 });
  }
}
