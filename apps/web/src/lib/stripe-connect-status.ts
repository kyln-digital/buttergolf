import type Stripe from "stripe";
import {
  classifyPayoutRequirements,
  type PayoutAccountStatus,
  type PayoutBankAccountSummary,
  type PayoutRequirements,
} from "@buttergolf/constants";

/**
 * The pure half of the Connect integration: everything that turns a Stripe
 * account object (or an inbound Request) into plain data.
 *
 * Deliberately free of prisma, the Stripe client and anything that reads env
 * at import time, so `tests/stripe-connect-status.test.ts` can import it
 * without a STRIPE_SECRET_KEY. `@/lib/stripe-connect` re-exports all of it, so
 * callers need not care which file a symbol lives in.
 */

// ---------------------------------------------------------------------------
// Terms-of-service evidence
// ---------------------------------------------------------------------------

export interface TosAcceptanceEvidence {
  ip: string | null;
  userAgent: string | null;
}

/** First hop of x-forwarded-for, falling back to x-real-ip. */
export function getRequestClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Evidence that the user accepted our terms (which incorporate the Stripe
 * Connected Account Agreement) from the request they made in their own
 * browser or app. Stripe requires the date and IP; user agent is optional.
 */
export function getTosEvidenceFromRequest(request: Request): TosAcceptanceEvidence {
  return {
    ip: getRequestClientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

export interface ConnectStatusSummary {
  status: PayoutAccountStatus;
  isComplete: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  requirements: PayoutRequirements;
  needsDetails: boolean;
  needsBankAccount: boolean;
  needsVerification: boolean;
  verificationFields: string[];
  bankAccount: PayoutBankAccountSummary | null;
  hasDob: boolean;
}

export function firstBankAccount(account: Stripe.Account): PayoutBankAccountSummary | null {
  const external = account.external_accounts?.data.find(
    (item): item is Stripe.BankAccount => item.object === "bank_account"
  );
  if (!external) return null;
  return {
    bankName: external.bank_name ?? null,
    last4: external.last4,
    sortCode: external.routing_number ?? null,
    accountHolderName: external.account_holder_name ?? null,
  };
}

/**
 * One derivation of "where is this seller's payout setup" used by the status
 * routes, the Connect webhook and the account-creation path alike.
 *
 * `isComplete` is the gate every transfer path uses (via
 * User.stripeOnboardingComplete): payouts enabled, transfers capability
 * active, nothing currently due.
 */
export function deriveConnectStatus(account: Stripe.Account): ConnectStatusSummary {
  const reqs = account.requirements;
  const currentlyDue = reqs?.currently_due ?? [];
  const pastDue = reqs?.past_due ?? [];
  const eventuallyDue = reqs?.eventually_due ?? [];
  const pendingVerification = reqs?.pending_verification ?? [];
  const disabledReason = reqs?.disabled_reason ?? null;

  const payoutsEnabled = account.payouts_enabled ?? false;
  const transfersActive = account.capabilities?.transfers === "active";
  const bankAccount = firstBankAccount(account);

  const isRejected = disabledReason?.includes("rejected") ?? false;

  // Nothing outstanding at all: Stripe normally mirrors past_due into
  // currently_due, but the transfer gate must not depend on that, and a
  // rejected account is never payable whatever its capability flags say.
  const isComplete =
    payoutsEnabled &&
    transfersActive &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    !isRejected;

  let status: PayoutAccountStatus = "pending";
  if (isRejected) status = "rejected";
  else if (isComplete) status = "active";
  else if (pastDue.length > 0) status = "restricted";

  const classification = classifyPayoutRequirements([...currentlyDue, ...pastDue]);

  return {
    status,
    isComplete,
    payoutsEnabled,
    transfersActive,
    requirements: {
      currentlyDue,
      pastDue,
      eventuallyDue,
      pendingVerification,
      disabledReason,
      currentDeadline: reqs?.current_deadline
        ? new Date(reqs.current_deadline * 1000).toISOString()
        : null,
      errors: (reqs?.errors ?? []).map((e) => ({
        requirement: e.requirement,
        code: e.code,
        reason: e.reason,
      })),
    },
    needsDetails: classification.needsDetails,
    // Stripe only lists external_account while none exists; a bank account
    // that later fails verification shows up as an error instead.
    needsBankAccount: classification.needsBankAccount || bankAccount === null,
    needsVerification: classification.needsVerification,
    verificationFields: classification.verificationFields,
    bankAccount,
    hasDob: Boolean(account.individual?.dob?.year),
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a Stripe validation error to a message the form can show next to the
 * offending field. Returns null for anything that isn't a bad-input error.
 */
export function describeStripeInputError(
  error: unknown
): { message: string; param: string | null } | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as { type?: string; message?: string; param?: string };
  if (e.type !== "StripeInvalidRequestError") return null;
  return { message: e.message ?? "Stripe rejected those details", param: e.param ?? null };
}
