import assert from "node:assert/strict";
import test from "node:test";
import { estimateDurationMinutes, lookupPrice, OFFICIAL_PRICES } from "../src/lib/pricing";

test("official AC and DC rates are preserved exactly", () => {
  assert.equal(lookupPrice("AC", 7.4, OFFICIAL_PRICES), 25);
  assert.equal(lookupPrice("DC", 25, OFFICIAL_PRICES), 36);
  assert.equal(lookupPrice("DC", 90, OFFICIAL_PRICES), 47);
});

test("estimateDurationMinutes computes a realistic charging duration", () => {
  const minutes = estimateDurationMinutes(20, 7.4, 7.4, 0.9);
  assert.ok(minutes > 0);
  assert.ok(minutes < 200);
});
