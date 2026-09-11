/**
 * When a buyer may raise a problem with an order, and what it means for the
 * payout hold. Pure so the rule is testable and shared by the API route and
 * the order page.
 *
 * Opening an issue freezes the hold (paymentHoldStatus → DISPUTED). The
 * confirm-receipt route, the auto-release cron and the refund webhook all
 * already treat DISPUTED as "do not release", so nothing else needs to know.
 */

export type IssueOrderStatus =
  | "PAYMENT_CONFIRMED"
  | "LABEL_GENERATED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type IssueHoldStatus =
  | "HELD"
  | "PENDING_SELLER_ONBOARDING"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

export interface IssueEligibilityInput {
  status: IssueOrderStatus;
  paymentHoldStatus: IssueHoldStatus;
  hasIssue: boolean;
}

export type IssueEligibility =
  | { allowed: true }
  | {
      allowed: false;
      reason: "ALREADY_OPEN" | "ORDER_CLOSED" | "ALREADY_RELEASED" | "STRIPE_DISPUTE";
      message: string;
    };

/** Holds an issue can be opened against: the money is still with us. */
const OPENABLE_HOLDS: ReadonlySet<IssueHoldStatus> = new Set(["HELD", "PENDING_SELLER_ONBOARDING"]);

export function canOpenIssue(input: IssueEligibilityInput): IssueEligibility {
  if (input.hasIssue) {
    return {
      allowed: false,
      reason: "ALREADY_OPEN",
      message: "A problem has already been reported for this order.",
    };
  }
  if (input.status === "CANCELLED" || input.status === "REFUNDED") {
    return {
      allowed: false,
      reason: "ORDER_CLOSED",
      message: "This order has already been cancelled or refunded.",
    };
  }
  if (input.paymentHoldStatus === "RELEASED") {
    return {
      allowed: false,
      reason: "ALREADY_RELEASED",
      message:
        "Payment for this order has already been released to the seller. Contact support@buttergolf.com and we'll help.",
    };
  }
  if (input.paymentHoldStatus === "DISPUTED") {
    return {
      allowed: false,
      reason: "STRIPE_DISPUTE",
      message: "This order is already under review.",
    };
  }
  if (!OPENABLE_HOLDS.has(input.paymentHoldStatus)) {
    return {
      allowed: false,
      reason: "ORDER_CLOSED",
      message: "This order can no longer be disputed.",
    };
  }
  return { allowed: true };
}

export const ISSUE_REASON_LABELS = {
  NOT_RECEIVED: "Item hasn't arrived",
  NOT_AS_DESCRIBED: "Not as described",
  DAMAGED: "Arrived damaged",
  WRONG_ITEM: "Wrong item sent",
  OTHER: "Something else",
} as const;

export type IssueReason = keyof typeof ISSUE_REASON_LABELS;

export function isIssueReason(value: unknown): value is IssueReason {
  return typeof value === "string" && value in ISSUE_REASON_LABELS;
}

export const ISSUE_DESCRIPTION_MIN = 20;
export const ISSUE_DESCRIPTION_MAX = 2000;

export function validateIssueDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < ISSUE_DESCRIPTION_MIN || trimmed.length > ISSUE_DESCRIPTION_MAX) return null;
  return trimmed;
}
