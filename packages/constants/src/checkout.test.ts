import { describe, it, expect } from "vitest";
import {
  SHIPPING_OPTIONS,
  getShippingOption,
  calculateBuyerProtectionFeeInPence,
  PROTECTION_FEE_MINIMUM_PENCE,
} from "./checkout";

describe("calculateBuyerProtectionFeeInPence", () => {
  it("is 5% of price plus 70p fixed", () => {
    // £100.00 -> 500p (5%) + 70p = 570p
    expect(calculateBuyerProtectionFeeInPence(10_000)).toBe(570);
  });

  it("rounds the percentage component to the nearest penny", () => {
    // £9.99 -> 49.95p rounds to 50p, + 70p = 120p
    expect(calculateBuyerProtectionFeeInPence(999)).toBe(120);
  });

  it("never returns less than the minimum fee", () => {
    expect(calculateBuyerProtectionFeeInPence(0)).toBe(PROTECTION_FEE_MINIMUM_PENCE);
    expect(calculateBuyerProtectionFeeInPence(1)).toBeGreaterThanOrEqual(
      PROTECTION_FEE_MINIMUM_PENCE
    );
  });

  it("returns integer pence (no floating point drift)", () => {
    for (const price of [123, 4567, 89_999, 250_00]) {
      const fee = calculateBuyerProtectionFeeInPence(price);
      expect(Number.isInteger(fee)).toBe(true);
    }
  });
});

describe("shipping options", () => {
  it("exposes a stable, non-empty set with integer pence prices", () => {
    expect(SHIPPING_OPTIONS.length).toBeGreaterThan(0);
    for (const option of SHIPPING_OPTIONS) {
      expect(Number.isInteger(option.priceInPence)).toBe(true);
      expect(option.priceInPence).toBeGreaterThan(0);
    }
  });

  it("looks up an option by id and returns undefined for unknown ids", () => {
    expect(getShippingOption("standard")?.priceInPence).toBe(499);
    expect(getShippingOption("does-not-exist")).toBeUndefined();
  });

  it("has unique option ids", () => {
    const ids = SHIPPING_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
