import { describe, it, expect } from "vitest";
import { requesterOwnsPaymentIntent } from "../apps/web/src/lib/payment-intent-ownership";

describe("requesterOwnsPaymentIntent", () => {
  const buyer = { id: "user-buyer" };
  const stranger = { id: "user-stranger" };

  const ownedIntent = {
    metadata: {
      buyerId: "user-buyer",
      sellerId: "user-seller",
    },
  };

  it("allows the buyer named in metadata", () => {
    expect(requesterOwnsPaymentIntent(ownedIntent, buyer)).toBe(true);
  });

  it("rejects authenticated user A for user B's PaymentIntent (BOLA)", () => {
    // Tip finding on buttergolf#521: never call createOrderFromPaymentIntent
    // or return `processing` for a non-owned paymentIntentId.
    expect(requesterOwnsPaymentIntent(ownedIntent, stranger)).toBe(false);
  });

  it("allows the seller named in metadata", () => {
    expect(requesterOwnsPaymentIntent(ownedIntent, { id: "user-seller" })).toBe(true);
  });

  it("fails closed when metadata is missing", () => {
    expect(requesterOwnsPaymentIntent({ metadata: null }, buyer)).toBe(false);
    expect(requesterOwnsPaymentIntent({ metadata: {} }, buyer)).toBe(false);
  });
});
