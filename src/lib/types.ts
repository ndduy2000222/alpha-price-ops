export type PricingRule =
  | { kind: "amount"; value: number }
  | { kind: "percent"; value: number };

export type DecisionStatus =
  | "needs_review"
  | "suggested"
  | "unchanged"
  | "blocked"
  | "paused";

export type OperatingMode = "Monitor" | "Review" | "Auto";

export type CompetitorOffer = {
  id: string;
  shopName: string;
  itemName: string;
  variantName: string;
  price: number;
  inStock: boolean;
  observedAt: string;
  source: "mock" | "manual" | "shopee_api";
  valid: boolean;
};

export type TrackedSku = {
  id: string;
  sku: string;
  title: string;
  variant: string;
  currentPrice: number;
  floorPrice: number;
  ceilingPrice: number;
  rule: PricingRule;
  mode: OperatingMode;
  allowIncrease: boolean;
  paused: boolean;
  cooldownHours: number;
  lastChangedAt?: string;
  competitorOffers: CompetitorOffer[];
  status: DecisionStatus;
  recommendation?: number;
  reason: string;
};

export type DecisionRecord = {
  id: string;
  skuId: string;
  sku: string;
  createdAt: string;
  action: "suggest" | "approve" | "reject" | "execute" | "skip";
  beforePrice: number;
  afterPrice?: number;
  reason: string;
  source: "mock" | "manual" | "shopee_api";
};
