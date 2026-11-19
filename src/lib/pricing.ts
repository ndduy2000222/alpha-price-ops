import type { PricingRule, TrackedSku } from "./types.ts";

export type PricingInput = Pick<TrackedSku, "currentPrice" | "floorPrice" | "ceilingPrice" | "allowIncrease" | "paused" | "cooldownHours" | "lastChangedAt"> & {
  rule: PricingRule;
  offers: { price: number; inStock: boolean; valid: boolean; observedAt: string }[];
  now?: Date;
  maxAgeHours?: number;
  maxDropPercent?: number;
};

export type PricingDecision = {
  status: "suggested" | "unchanged" | "blocked" | "paused";
  referencePrice?: number;
  proposedPrice?: number;
  reason: string;
};

const roundToThousand = (value: number) => Math.round(value / 1000) * 1000;

export function calculateRecommendation(input: PricingInput): PricingDecision {
  if (input.paused) return { status: "paused", reason: "SKU đang tạm dừng." };
  const now = input.now ?? new Date();
  const maxAgeHours = input.maxAgeHours ?? 8;
  const validOffers = input.offers.filter((offer) => {
    const age = (now.getTime() - new Date(offer.observedAt).getTime()) / 36e5;
    return offer.valid && offer.inStock && age <= maxAgeHours && Number.isFinite(offer.price) && offer.price > 0;
  });
  if (!validOffers.length) return { status: "blocked", reason: "Không có đối thủ hợp lệ hoặc dữ liệu đã quá cũ." };
  if (input.lastChangedAt) {
    const hoursSinceChange = (now.getTime() - new Date(input.lastChangedAt).getTime()) / 36e5;
    if (hoursSinceChange < input.cooldownHours) {
      return { status: "blocked", referencePrice: Math.min(...validOffers.map((o) => o.price)), reason: `Chưa hết khoảng nghỉ tối thiểu ${input.cooldownHours} giờ.` };
    }
  }
  const referencePrice = Math.min(...validOffers.map((offer) => offer.price));
  const raw = input.rule.kind === "amount"
    ? referencePrice - input.rule.value
    : referencePrice * (1 - input.rule.value / 100);
  const bounded = Math.min(input.ceilingPrice, Math.max(input.floorPrice, roundToThousand(raw)));
  if (bounded < input.currentPrice && input.floorPrice > raw) {
    return { status: "blocked", referencePrice, proposedPrice: bounded, reason: "Không đạt mức chênh mục tiêu do giới hạn giá sàn." };
  }
  if (bounded > input.currentPrice && !input.allowIncrease) {
    return { status: "unchanged", referencePrice, proposedPrice: bounded, reason: "Đối thủ tăng giá nhưng cấu hình không cho phép tự tăng giá." };
  }
  if (bounded === input.currentPrice) return { status: "unchanged", referencePrice, proposedPrice: bounded, reason: "Giá hiện tại đã nằm trong quy tắc." };
  const drop = (input.currentPrice - bounded) / input.currentPrice;
  if (drop > (input.maxDropPercent ?? 20) / 100) {
    return { status: "blocked", referencePrice, proposedPrice: bounded, reason: "Biến động giảm vượt giới hạn an toàn trong một lần." };
  }
  return { status: "suggested", referencePrice, proposedPrice: bounded, reason: "Đề xuất theo đối thủ hợp lệ thấp nhất và quy tắc đã cấu hình." };
}
