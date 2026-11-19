import { initialDecisions, initialSkus } from "@/src/lib/mock-data";
import type { CompetitorOffer, DecisionRecord, TrackedSku } from "@/src/lib/types";
import { dataMode, getSql } from "./db";

type DashboardSnapshot = {
  mode: "demo" | "database";
  skus: TrackedSku[];
  decisions: DecisionRecord[];
};

function demoSnapshot(): DashboardSnapshot {
  return { mode: "demo", skus: initialSkus, decisions: initialDecisions };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const sql = getSql();
  if (!sql || dataMode() === "demo") return demoSnapshot();

  const [skuRows, offerRows, recommendationRows] = await Promise.all([
    sql<{
      id: string;
      sku: string | null;
      title: string;
      variant: string;
      current_price: number;
      floor_price: number | null;
      ceiling_price: number | null;
      rule_kind: "amount" | "percent" | null;
      rule_value: number | null;
      mode: "Monitor" | "Review" | "Auto";
      allow_increase: boolean;
      paused: boolean;
      cooldown_hours: number;
      recommendation_status: TrackedSku["status"] | null;
      proposed_price: number | null;
      recommendation_reason: string | null;
    }[]>`
      select pm.id, pm.sku, p.title, coalesce(pm.title, 'Mặc định') as variant,
        pm.current_price, pr.floor_price, pr.ceiling_price, pr.kind as rule_kind,
        pr.value as rule_value, case when pr.active then 'Review' else 'Monitor' end as mode,
        coalesce(pr.allow_increase, false) as allow_increase, false as paused,
        coalesce(pr.cooldown_hours, 0) as cooldown_hours, rec.status as recommendation_status,
        rec.proposed_price, rec.reason as recommendation_reason
      from product_models pm
      join products p on p.id = pm.product_id
      left join lateral (select * from pricing_rules where pricing_rules.model_id = pm.id and pricing_rules.active = true order by version desc limit 1) pr on true
      left join lateral (select * from price_recommendations where price_recommendations.model_id = pm.id order by created_at desc limit 1) rec on true
      order by p.title, pm.title
    `,
    sql<{
      model_id: string;
      shop_name: string;
      item_name: string;
      variant_name: string;
      price: number;
      in_stock: boolean;
      observed_at: string;
      source: CompetitorOffer["source"];
    }[]>`
      select distinct on (cl.model_id, cl.id) cl.model_id, c.name as shop_name,
        cl.external_item_id as item_name, coalesce(cl.variant_name, '') as variant_name,
        co.observed_price as price, co.in_stock, co.observed_at,
        case when co.source in ('mock', 'manual', 'shopee_api') then co.source else 'manual' end as source
      from competitor_links cl
      join competitors c on c.id = cl.competitor_id
      join competitor_observations co on co.link_id = cl.id
      where cl.status = 'active' and co.valid = true
      order by cl.model_id, cl.id, co.observed_at desc
    `,
    sql<{
      id: string;
      model_id: string;
      status: string;
      current_price: number;
      proposed_price: number | null;
      reason: string;
      created_at: string;
    }[]>`select id, model_id, status, current_price, proposed_price, reason, created_at from price_recommendations order by created_at desc limit 50`,
  ]);

  const offersByModel = new Map<string, CompetitorOffer[]>();
  for (const row of offerRows) {
    const offers = offersByModel.get(row.model_id) ?? [];
    offers.push({ id: `${row.model_id}-${row.shop_name}`, shopName: row.shop_name, itemName: row.item_name, variantName: row.variant_name, price: Number(row.price), inStock: row.in_stock, observedAt: new Date(row.observed_at).toISOString(), source: row.source, valid: true });
    offersByModel.set(row.model_id, offers);
  }

  const skus = skuRows.map((row): TrackedSku => ({
    id: row.id,
    sku: row.sku ?? row.id.slice(0, 8),
    title: row.title,
    variant: row.variant,
    currentPrice: Number(row.current_price),
    floorPrice: Number(row.floor_price ?? row.current_price),
    ceilingPrice: Number(row.ceiling_price ?? row.current_price),
    rule: row.rule_kind && row.rule_value != null ? { kind: row.rule_kind, value: Number(row.rule_value) } : { kind: "amount", value: 0 },
    mode: row.mode,
    allowIncrease: row.allow_increase,
    paused: row.paused,
    cooldownHours: Number(row.cooldown_hours),
    competitorOffers: offersByModel.get(row.id) ?? [],
    status: row.recommendation_status ?? "unchanged",
    recommendation: row.proposed_price == null ? undefined : Number(row.proposed_price),
    reason: row.recommendation_reason ?? "Chưa có recommendation gần nhất.",
  }));

  const decisions = recommendationRows.map((row): DecisionRecord => ({
    id: row.id,
    skuId: row.model_id,
    sku: row.model_id.slice(0, 8),
    createdAt: new Date(row.created_at).toISOString(),
    action: row.status === "approved" ? "approve" : row.status === "rejected" ? "reject" : "suggest",
    beforePrice: Number(row.current_price),
    afterPrice: row.proposed_price == null ? undefined : Number(row.proposed_price),
    reason: row.reason,
    source: "manual",
  }));

  return { mode: "database", skus, decisions };
}
