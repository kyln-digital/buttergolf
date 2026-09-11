import { describe, it, expect } from "vitest";
import {
  canOpenIssue,
  isIssueReason,
  validateIssueDescription,
} from "../apps/web/src/lib/order-issue-state";

describe("canOpenIssue", () => {
  const base = { status: "SHIPPED", paymentHoldStatus: "HELD", hasIssue: false } as const;

  it("allows a held order with no existing issue", () => {
    expect(canOpenIssue(base)).toEqual({ allowed: true });
    expect(canOpenIssue({ ...base, status: "DELIVERED" })).toEqual({ allowed: true });
    expect(canOpenIssue({ ...base, status: "PAYMENT_CONFIRMED" })).toEqual({ allowed: true });
  });

  it("allows while funds are parked on seller onboarding", () => {
    expect(canOpenIssue({ ...base, paymentHoldStatus: "PENDING_SELLER_ONBOARDING" })).toEqual({
      allowed: true,
    });
  });

  it("refuses a second issue", () => {
    const result = canOpenIssue({ ...base, hasIssue: true });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("ALREADY_OPEN");
  });

  it("refuses once the money has gone to the seller", () => {
    const result = canOpenIssue({ ...base, paymentHoldStatus: "RELEASED" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("ALREADY_RELEASED");
  });

  it("refuses when Stripe already has a chargeback open", () => {
    const result = canOpenIssue({ ...base, paymentHoldStatus: "DISPUTED" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("STRIPE_DISPUTE");
  });

  it("refuses cancelled and refunded orders regardless of hold", () => {
    for (const status of ["CANCELLED", "REFUNDED"] as const) {
      const result = canOpenIssue({ ...base, status, paymentHoldStatus: "REFUNDED" });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reason).toBe("ORDER_CLOSED");
    }
  });
});

describe("issue input validation", () => {
  it("accepts only known reasons", () => {
    expect(isIssueReason("NOT_RECEIVED")).toBe(true);
    expect(isIssueReason("OTHER")).toBe(true);
    expect(isIssueReason("not_received")).toBe(false);
    expect(isIssueReason(42)).toBe(false);
  });

  it("trims and bounds the description", () => {
    expect(validateIssueDescription("  too short  ")).toBeNull();
    expect(validateIssueDescription("The driver head has a crack along the crown.")).toBe(
      "The driver head has a crack along the crown."
    );
    expect(validateIssueDescription("x".repeat(2001))).toBeNull();
    expect(validateIssueDescription(null)).toBeNull();
  });
});
