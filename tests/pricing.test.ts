import { describe, it, expect } from "vitest";
import {
  LISTING_PRICE_LIMITS,
  getListingPriceBoundsMessage,
} from "../packages/constants/src/pricing";

describe("pricing constants", () => {
  it("exposes sensible listing price bounds in GBP", () => {
    expect(LISTING_PRICE_LIMITS.MIN).toBe(1);
    expect(LISTING_PRICE_LIMITS.MAX).toBe(10000);
  });

  it("renders the bounds message using the configured limits", () => {
    expect(getListingPriceBoundsMessage()).toBe("Price must be between GBP 1 and GBP 10000.");
  });
});
