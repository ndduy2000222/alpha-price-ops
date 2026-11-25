import { createHmac } from "node:crypto";
import { decryptSecret } from "./secrets";
import { dataMode, getSql } from "./db";

const SHOPEE_BASE_URL = "https://partner.shopeemobile.com";
const ITEM_LIST_PATH = "/api/v2/product/get_item_list";
const ITEM_BASE_INFO_PATH = "/api/v2/product/get_item_base_info";
const PAGE_SIZE = 50;
const ITEM_BATCH_SIZE = 50;
const ITEM_STATUSES = ["NORMAL", "UNLIST", "BANNED", "DELETED"] as const;

type JsonRecord = Record<string, unknown>;

export type SyncCursor = {
  statusIndex: number;
  offset: number;
};

type SyncResult = {
  shopId: string;
  runId: string;
  complete: boolean;
  nextCursor: SyncCursor | null;
  statusFilter: string;
  listedOnPage: number;
  totalForStatus: number | null;
  itemsSeen: number;
  productsUpserted: number;
  modelsUpserted: number;
  snapshotsCreated: number;
  skippedModels: number;
  status: "succeeded" | "partial";
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item) => Object.keys(item).length > 0) : [];
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function number(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "TRUE";
}

function apiError(payload: JsonRecord): string | null {
  const error = text(payload.error);
  return error ? `Shopee API error: ${error}${text(payload.message) ? ` (${text(payload.message)})` : ""}` : null;
}

function sign(path: string, timestamp: number, partnerId: number, partnerKey: string, accessToken: string, shopId: number): string {
  return createHmac("sha256", partnerKey).update(`${partnerId}${path}${timestamp}${accessToken}${shopId}`).digest("hex");
}

async function shopeeGet(path: string, config: { partnerId: number; partnerKey: string; accessToken: string; shopId: number }, params: Record<string, string | number | string[]>): Promise<JsonRecord> {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(`${SHOPEE_BASE_URL}${path}`);
  url.searchParams.set("partner_id", String(config.partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("access_token", config.accessToken);
  url.searchParams.set("shop_id", String(config.shopId));
  url.searchParams.set("sign", sign(path, timestamp, config.partnerId, config.partnerKey, config.accessToken, config.shopId));
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((entry) => url.searchParams.append(key, entry));
    else url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Shopee API request timed out: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Shopee API HTTP ${response.status}`);
  const payload = record(await response.json());
  const error = apiError(payload);
  if (error) throw new Error(error);
  return payload;
}

async function listItemPage(config: { partnerId: number; partnerKey: string; accessToken: string; shopId: number }, cursor: SyncCursor): Promise<{ itemIds: number[]; itemStatus: string; totalCount: number | null; nextCursor: SyncCursor | null }> {
  const itemStatus = ITEM_STATUSES[cursor.statusIndex];
  if (!itemStatus) return { itemIds: [], itemStatus: "done", totalCount: 0, nextCursor: null };
  const payload = await shopeeGet(ITEM_LIST_PATH, config, { offset: cursor.offset, page_size: PAGE_SIZE, item_status: itemStatus });
  const response = record(payload.response);
  const items = [...records(response.item), ...records(response.item_list)];
  const itemIds = items.map((item) => number(item.item_id)).filter((itemId): itemId is number => itemId != null);
  const totalCount = number(response.total_count);
  const hasNext = booleanValue(response.has_next_page);
  const returnedNextOffset = number(response.next_offset);
  const calculatedNextOffset = returnedNextOffset ?? cursor.offset + items.length;
  const hasMoreForStatus = items.length > 0 && (hasNext || (totalCount != null && calculatedNextOffset < totalCount));
  const nextCursor = hasMoreForStatus
    ? { statusIndex: cursor.statusIndex, offset: calculatedNextOffset }
    : cursor.statusIndex + 1 < ITEM_STATUSES.length
      ? { statusIndex: cursor.statusIndex + 1, offset: 0 }
      : null;
  return { itemIds, itemStatus, totalCount, nextCursor };
}

function modelRows(item: JsonRecord): JsonRecord[] {
  const explicitModels = [...records(item.model), ...records(item.models), ...records(item.model_list)];
  if (explicitModels.length > 0) return explicitModels;
  return [{
    model_id: item.item_id,
    model_name: "Mặc định",
    model_sku: item.item_sku,
    price_info: records(item.price_info)[0] ?? record(item.price_info),
    stock_info: records(item.stock_info)[0] ?? record(item.stock_info),
  }];
}

function priceInfo(model: JsonRecord, item: JsonRecord): JsonRecord {
  const modelInfo = records(model.price_info)[0] ?? (Object.keys(record(model.price_info)).length > 0 ? record(model.price_info) : null);
  const itemInfo = records(item.price_info)[0] ?? (Object.keys(record(item.price_info)).length > 0 ? record(item.price_info) : null);
  return modelInfo ?? itemInfo ?? {};
}

function stockInfo(model: JsonRecord, item: JsonRecord): JsonRecord {
  const modelInfo = records(model.stock_info)[0] ?? (Object.keys(record(model.stock_info)).length > 0 ? record(model.stock_info) : null);
  const itemInfo = records(item.stock_info)[0] ?? (Object.keys(record(item.stock_info)).length > 0 ? record(item.stock_info) : null);
  return modelInfo ?? itemInfo ?? {};
}

async function upsertItem(sql: NonNullable<ReturnType<typeof getSql>>, shopId: string, item: JsonRecord, observedAt: Date): Promise<{ models: number; snapshots: number; skipped: number }> {
  const externalItemId = number(item.item_id);
  const title = text(item.item_name, item.title);
  if (externalItemId == null || !title) return { models: 0, snapshots: 0, skipped: 1 };
  const [product] = await sql`
    insert into products (shop_id, external_item_id, title, status, raw_payload, updated_at)
    values (${shopId}, ${String(externalItemId)}, ${title}, ${text(item.item_status) ?? "active"}, ${JSON.stringify(item)}::jsonb, now())
    on conflict (shop_id, external_item_id) do update set
      title = excluded.title,
      status = excluded.status,
      raw_payload = excluded.raw_payload,
      updated_at = now()
    returning id
  `;
  let models = 0;
  let snapshots = 0;
  let skipped = 0;
  for (const model of modelRows(item)) {
    const prices = priceInfo(model, item);
    const stocks = stockInfo(model, item);
    const externalModelId = String(number(model.model_id, externalItemId) ?? externalItemId);
    const currentPrice = number(prices.current_price, prices.original_price, model.current_price, item.current_price);
    if (currentPrice == null || currentPrice < 0) {
      skipped += 1;
      continue;
    }
    const promotionPrice = number(prices.promotion_price, model.promotion_price, item.promotion_price);
    const stock = Math.max(0, number(stocks.current_stock, stocks.normal_stock, stocks.stock, model.stock, item.stock) ?? 0);
    const sku = text(model.model_sku, model.sku, item.item_sku);
    const modelTitle = text(model.model_name, model.name) ?? "Mặc định";
    const [savedModel] = await sql`
      insert into product_models (product_id, external_model_id, sku, title, current_price, promotion_price, stock, status, raw_payload, updated_at)
      values (${product.id}, ${externalModelId}, ${sku}, ${modelTitle}, ${currentPrice}, ${promotionPrice}, ${stock}, 'active', ${JSON.stringify(model)}::jsonb, now())
      on conflict (product_id, external_model_id) do update set
        sku = excluded.sku,
        title = excluded.title,
        current_price = excluded.current_price,
        promotion_price = excluded.promotion_price,
        stock = excluded.stock,
        status = excluded.status,
        raw_payload = excluded.raw_payload,
        updated_at = now()
      returning id
    `;
    await sql`
      insert into price_snapshots (shop_id, model_id, listing_price, promotion_price, stock, source, observed_at, raw_payload)
      values (${shopId}, ${savedModel.id}, ${currentPrice}, ${promotionPrice}, ${stock}, 'shopee_api', ${observedAt}, ${JSON.stringify({ item, model })}::jsonb)
    `;
    models += 1;
    snapshots += 1;
  }
  return { models, snapshots, skipped };
}

export async function syncShopeeProducts(externalShopId?: string, cursor: SyncCursor | null = null, runId?: string): Promise<SyncResult> {
  if (dataMode() !== "database") throw new Error("Database mode is required for Shopee product sync");
  const sql = getSql();
  if (!sql) throw new Error("Database connection is not configured");
  const connections = externalShopId
    ? await sql`select s.id as shop_id, s.external_shop_id, sc.access_token_ciphertext from shops s join shop_connections sc on sc.shop_id = s.id where s.platform = 'shopee' and s.external_shop_id = ${externalShopId} and sc.provider = 'shopee' and sc.status = 'connected' limit 1`
    : await sql`select s.id as shop_id, s.external_shop_id, sc.access_token_ciphertext from shops s join shop_connections sc on sc.shop_id = s.id where s.platform = 'shopee' and sc.provider = 'shopee' and sc.status = 'connected' order by sc.last_sync_at nulls first limit 1`;
  const connection = connections[0] as { shop_id: string; external_shop_id: string; access_token_ciphertext: string } | undefined;
  if (!connection) throw new Error("No connected Shopee shop was found");
  const shopId = Number(connection.external_shop_id);
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!Number.isSafeInteger(shopId) || !Number.isSafeInteger(partnerId) || !partnerKey) throw new Error("Shopee partner credentials are not configured");
  const accessToken = decryptSecret(connection.access_token_ciphertext);
  const [run] = runId
    ? await sql`select id from sync_runs where id = ${runId} and shop_id = ${connection.shop_id} and provider = 'shopee' and sync_kind = 'products' limit 1`
    : await sql`insert into sync_runs (shop_id, provider, sync_kind, status) values (${connection.shop_id}, 'shopee', 'products', 'running') returning id`;
  if (!run) throw new Error("The requested product sync run was not found");
  let itemsSeen = 0;
  let productsUpserted = 0;
  let modelsUpserted = 0;
  let snapshotsCreated = 0;
  let skippedModels = 0;
  try {
    const config = { partnerId, partnerKey, accessToken, shopId };
    const page = await listItemPage(config, cursor ?? { statusIndex: 0, offset: 0 });
    const observedAt = new Date();
    for (let index = 0; index < page.itemIds.length; index += ITEM_BATCH_SIZE) {
      const batch = page.itemIds.slice(index, index + ITEM_BATCH_SIZE);
      const payload = await shopeeGet(ITEM_BASE_INFO_PATH, config, { item_id_list: batch.join(",") });
      const response = record(payload.response);
      const items = records(response.item_list).concat(records(response.items), records(response.item)).map((item) => ({ ...item, item_status: text(item.item_status) ?? page.itemStatus }));
      for (const item of items) {
        itemsSeen += 1;
        const result = await upsertItem(sql, connection.shop_id, item, observedAt);
        if (result.models > 0) productsUpserted += 1;
        modelsUpserted += result.models;
        snapshotsCreated += result.snapshots;
        skippedModels += result.skipped;
      }
    }
    const complete = page.nextCursor == null;
    const status = skippedModels > 0 ? "partial" : "succeeded";
    if (complete) {
      await sql`update sync_runs set status = ${status}, records_seen = records_seen + ${itemsSeen}, records_upserted = records_upserted + ${modelsUpserted}, finished_at = now() where id = ${run.id}`;
      await sql`update shop_connections set last_sync_at = now(), updated_at = now() where shop_id = ${connection.shop_id} and provider = 'shopee'`;
      await sql`insert into audit_events (shop_id, actor_id, action, entity_type, entity_id, after_state, reason) values (${connection.shop_id}, 'shopee-sync', 'products_synced', 'sync_run', ${String(run.id)}, ${JSON.stringify({ itemsSeen, modelsUpserted, snapshotsCreated, skippedModels })}::jsonb, 'Shopee product read synchronization completed')`;
    } else {
      await sql`update sync_runs set records_seen = records_seen + ${itemsSeen}, records_upserted = records_upserted + ${modelsUpserted} where id = ${run.id}`;
    }
    return { shopId: connection.external_shop_id, runId: String(run.id), complete, nextCursor: page.nextCursor, statusFilter: page.itemStatus, listedOnPage: page.itemIds.length, totalForStatus: page.totalCount, itemsSeen, productsUpserted, modelsUpserted, snapshotsCreated, skippedModels, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopee product sync failed";
    await sql`update sync_runs set status = 'failed', records_seen = records_seen + ${itemsSeen}, records_upserted = records_upserted + ${modelsUpserted}, error_message = ${message.slice(0, 1000)}, finished_at = now() where id = ${run.id}`;
    throw error;
  }
}
