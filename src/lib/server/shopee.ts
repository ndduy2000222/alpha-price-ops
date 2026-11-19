import { createHmac } from "node:crypto";
import { encryptSecret } from "./secrets";
import { getSql } from "./db";

const SHOPEE_BASE_URL = "https://partner.shopeemobile.com";
const TOKEN_PATH = "/api/v2/auth/token/get";
const SHOP_INFO_PATH = "/api/v2/shop/get_shop_info";

type ShopeeConfig = { partnerId: number; partnerKey: string };

type TokenResponse = {
  error?: string;
  message?: string;
  request_id?: string;
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  shop_id_list?: number[];
};

type ShopInfoResponse = {
  error?: string;
  message?: string;
  request_id?: string;
  response?: { shop_name?: string; shop_logo?: string; description?: string };
};

function config(): ShopeeConfig {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!Number.isSafeInteger(partnerId) || partnerId <= 0 || !partnerKey) {
    throw new Error("Shopee partner credentials are not configured");
  }
  return { partnerId, partnerKey };
}

function sign(path: string, timestamp: number, accessToken?: string, shopId?: number): string {
  const { partnerId, partnerKey } = config();
  const base = `${partnerId}${path}${timestamp}${accessToken ?? ""}${shopId ?? ""}`;
  return createHmac("sha256", partnerKey).update(base).digest("hex");
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Shopee API HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function apiError(payload: { error?: string; message?: string }): string | null {
  return payload.error ? `Shopee API error: ${payload.error}${payload.message ? ` (${payload.message})` : ""}` : null;
}

export async function exchangeAuthorizationCode(input: { code: string; shopId?: number; mainAccountId?: number }) {
  const { partnerId } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(`${SHOPEE_BASE_URL}${TOKEN_PATH}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign(TOKEN_PATH, timestamp));
  const body: Record<string, string | number> = { code: input.code, partner_id: partnerId };
  if (input.shopId) body.shop_id = input.shopId;
  if (input.mainAccountId) body.main_account_id = input.mainAccountId;
  const payload = await readJson<TokenResponse>(await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }));
  const error = apiError(payload);
  if (error || !payload.access_token || !payload.refresh_token) throw new Error(error ?? "Shopee did not return tokens");
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expireIn: Number(payload.expire_in ?? 14400),
    requestId: payload.request_id ?? null,
    shopIds: (payload.shop_id_list ?? []).map(Number).filter((value) => Number.isSafeInteger(value) && value > 0),
  };
}

export async function getShopInfo(input: { accessToken: string; shopId: number }) {
  const { partnerId } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(`${SHOPEE_BASE_URL}${SHOP_INFO_PATH}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("access_token", input.accessToken);
  url.searchParams.set("shop_id", String(input.shopId));
  url.searchParams.set("sign", sign(SHOP_INFO_PATH, timestamp, input.accessToken, input.shopId));
  const payload = await readJson<ShopInfoResponse>(await fetch(url, { cache: "no-store" }));
  const error = apiError(payload);
  if (error || !payload.response?.shop_name) throw new Error(error ?? "Shopee did not return the shop name");
  return { name: payload.response.shop_name, logo: payload.response.shop_logo ?? null, requestId: payload.request_id ?? null };
}

export async function persistShopeeConnection(input: {
  shopId: number;
  shopName: string;
  shopLogo: string | null;
  accessToken: string;
  refreshToken: string;
  expireIn: number;
  requestId: string | null;
}) {
  const sql = getSql();
  if (!sql) throw new Error("Database mode is required to persist the Shopee connection");
  const accessTokenCiphertext = encryptSecret(input.accessToken);
  const refreshTokenCiphertext = encryptSecret(input.refreshToken);
  await sql.begin(async (transaction) => {
    const [shop] = await transaction`
      insert into shops (platform, external_shop_id, name, status)
      values ('shopee', ${String(input.shopId)}, ${input.shopName}, 'active')
      on conflict (platform, external_shop_id) do update
      set name = excluded.name, status = 'active', updated_at = now()
      returning id
    `;
    await transaction`
      insert into shop_connections (shop_id, provider, external_account_id, status, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, metadata, last_sync_at, updated_at)
      values (${shop.id}, 'shopee', ${String(input.shopId)}, 'connected', ${accessTokenCiphertext}, ${refreshTokenCiphertext}, now() + (${input.expireIn} * interval '1 second'), ${JSON.stringify({ shopLogo: input.shopLogo, requestId: input.requestId })}::jsonb, now(), now())
      on conflict (shop_id, provider) do update set
        external_account_id = excluded.external_account_id,
        status = 'connected',
        access_token_ciphertext = excluded.access_token_ciphertext,
        refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        token_expires_at = excluded.token_expires_at,
        metadata = excluded.metadata,
        last_sync_at = excluded.last_sync_at,
        updated_at = now()
    `;
    await transaction`
      insert into audit_events (shop_id, actor_id, action, entity_type, entity_id, after_state, reason)
      values (${shop.id}, 'shopee-oauth', 'connection_authorized', 'shop_connection', ${String(input.shopId)}, ${JSON.stringify({ provider: "shopee", status: "connected" })}::jsonb, 'Shopee Open Platform authorization completed')
    `;
  });
}
