import { describe, it, expect } from "vitest";
import { requesterOwnsCheckoutSession } from "../apps/web/src/lib/checkout-session-ownership";

describe("requesterOwnsCheckoutSession", () => {
  const buyer = { id: "user-buyer", email: "buyer@example.com" };
  const stranger = { id: "user-stranger", email: "stranger@example.com" };

  const paidSessionOwnedByBuyer = {
    client_reference_id: null as string | null,
    customer_email: "buyer@example.com",
    metadata: {
      buyerId: "user-buyer",
      sellerId: "user-seller",
    },
  };

  it("allows the buyer named in metadata (paid-but-unmaterialised owner path)", () => {
    expect(requesterOwnsCheckoutSession(paidSessionOwnedByBuyer, buyer)).toBe(true);
  });

  it("rejects authenticated user A for user B's paid-but-unmaterialised session (BOLA)", () => {
    // Regression for buttergolf#521 residual: never disclose `processing`
    // when the requester does not own the Checkout session.
    expect(requesterOwnsCheckoutSession(paidSessionOwnedByBuyer, stranger)).toBe(false);
  });

  it("allows the seller named in metadata", () => {
    expect(
      requesterOwnsCheckoutSession(paidSessionOwnedByBuyer, {
        id: "user-seller",
        email: "seller@example.com",
      })
    ).toBe(true);
  });

  it("allows a match on client_reference_id", () => {
    expect(
      requesterOwnsCheckoutSession(
        {
          client_reference_id: stranger.id,
          customer_email: "other@example.com",
          metadata: { buyerId: "someone-else", sellerId: "user-seller" },
        },
        stranger
      )
    ).toBe(true);
  });

  it("allows a case-insensitive customer_email match when metadata is absent", () => {
    expect(
      requesterOwnsCheckoutSession(
        {
          client_reference_id: null,
          customer_email: "Buyer@Example.com",
          metadata: null,
        },
        buyer
      )
    ).toBe(true);
  });

  it("fails closed when no ownership signal matches", () => {
    expect(
      requesterOwnsCheckoutSession(
        {
          client_reference_id: null,
          customer_email: null,
          metadata: {},
        },
        buyer
      )
    ).toBe(false);
  });
});
