import test from "node:test";
import assert from "node:assert/strict";
import { calculateRecommendation } from "../src/lib/pricing.ts";

const base = { currentPrice: 100000, floorPrice: 80000, ceilingPrice: 130000, allowIncrease: false, paused: false, cooldownHours: 0, rule: { kind: "amount" as const, value: 1000 }, offers: [{ price: 90000, inStock: true, valid: true, observedAt: "2026-11-19T07:00:00.000Z" }], now: new Date("2026-11-19T08:00:00.000Z") };

test("fixed amount rule", () => assert.equal(calculateRecommendation(base).proposedPrice, 89000));
test("percentage rule", () => assert.equal(calculateRecommendation({ ...base, rule: { kind: "percent", value: 5 } }).proposedPrice, 86000));
test("floor constraint blocks target", () => {
  const result = calculateRecommendation({ ...base, floorPrice: 90000 });
  assert.equal(result.status, "blocked");
  assert.match(result.reason, /giới hạn giá sàn/);
});
test("stale and out of stock offers are ignored", () => {
  const result = calculateRecommendation({ ...base, offers: [{ ...base.offers[0], inStock: false }, { ...base.offers[0], observedAt: "2026-11-18T00:00:00.000Z" }] });
  assert.equal(result.status, "blocked");
});
test("increase is not applied without explicit permission", () => {
  const result = calculateRecommendation({ ...base, currentPrice: 80000, offers: [{ ...base.offers[0], price: 100000 }] });
  assert.equal(result.status, "unchanged");
  assert.match(result.reason, /không cho phép/);
});
test("pause and cooldown stop execution", () => {
  assert.equal(calculateRecommendation({ ...base, paused: true }).status, "paused");
  assert.equal(calculateRecommendation({ ...base, cooldownHours: 4, lastChangedAt: "2026-11-19T06:00:00.000Z" }).status, "blocked");
});
