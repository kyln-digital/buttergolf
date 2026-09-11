import type Stripe from "stripe";
import { after } from "next/server";
import { prisma } from "@buttergolf/db";
import {
  noPayoutAccountStatus,
  type PayoutPrefill,
  type PayoutStatus,
} from "@buttergolf/constants";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/base-url";
import {
  deriveConnectStatus,
  type ConnectStatusSummary,
  type TosAcceptanceEvidence,
} from "@/lib/stripe-connect-status";

/**
 * Pure helpers live in `stripe-connect-status.ts` so tests can import them
 * without Stripe credentials. Re-exported here so every existing
 * `@/lib/stripe-connect` import keeps working.
 */
export {
  deriveConnectStatus,
  describeStripeInputError,
  firstBankAccount,
  getRequestClientIp,
  getTosEvidenceFromRequest,
  type ConnectStatusSummary,
  type TosAcceptanceEvidence,
} from "@/lib/stripe-connect-status";

/**
 * Stripe Connect for sellers, ButterGolf-side.
 *
 * Sellers never see a Stripe form. The platform:
 *   1. creates the connected account silently (first listing publish, or the
 *      first time the seller opens payout setup) — `ensureConnectAccount`
 *   2. collects name / DOB / address / phone / bank in its own UI and pushes
 *      them via accounts.update — the /api/stripe/connect/setup/* routes
 *   3. reads the account back and derives one status for every caller —
 *      `getConnectStatusForUser` / `deriveConnectStatus`
 *
 * The only Stripe-rendered surface left is the embedded onboarding component,
 * restricted to verification requirements we cannot collect ourselves (ID
 * documents, proof of liveness). See PayoutStatus.verificationFields.
 *
 * Accounts request the `transfers` capability only: buyers pay the platform
 * (separate charges and transfers), so sellers never take card payments.
 */

function tosAcceptanceParams(
  tos: TosAcceptanceEvidence | undefined
): Stripe.AccountUpdateParams.TosAcceptance | undefined {
  if (!tos?.ip) return undefined;
  return {
    date: Math.floor(Date.now() / 1000),
    ip: tos.ip,
    ...(tos.userAgent ? { user_agent: tos.userAgent.slice(0, 512) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const CONNECT_USER_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  stripeConnectId: true,
  stripeOnboardingComplete: true,
  stripeAccountStatus: true,
  stripeRequirementsDue: true,
  addresses: {
    where: { isDefault: true },
    take: 1,
    select: { street1: true, street2: true, city: true, zip: true },
  },
} as const;

type ConnectUser = NonNullable<Awaited<ReturnType<typeof loadConnectUser>>>;

async function loadConnectUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: CONNECT_USER_SELECT });
}

function buildPrefill(user: ConnectUser, hasDob: boolean): PayoutPrefill {
  const address = user.addresses[0];
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? null,
    address: address
      ? {
          line1: address.street1,
          ...(address.street2 ? { line2: address.street2 } : {}),
          city: address.city,
          postalCode: address.zip,
        }
      : null,
    hasDob,
  };
}

/**
 * Forget a Connect account Stripe no longer knows about. When `accountId` is
 * given the clear only applies while that ID is still the one on file, so a
 * stale retrieval can never wipe an account a concurrent request just saved.
 */
export async function clearConnectAccount(userId: string, accountId?: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, ...(accountId ? { stripeConnectId: accountId } : {}) },
    data: {
      stripeConnectId: null,
      stripeOnboardingComplete: false,
      stripeAccountStatus: null,
      stripeAccountType: null,
      stripeRequirementsDue: null,
      stripeRequirementsDeadline: null,
    },
  });
}

/**
 * Persist the derived status. `stripeOnboardingComplete` is what the
 * transfer paths (confirm-receipt, release cron, onboarding drain) gate on.
 */
export async function syncConnectStatus(
  userId: string,
  summary: ConnectStatusSummary
): Promise<void> {
  const due = summary.requirements.currentlyDue;
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeOnboardingComplete: summary.isComplete,
      stripeAccountStatus: summary.status,
      stripeRequirementsDue: due.length > 0 ? due : null,
      stripeRequirementsDeadline: summary.requirements.currentDeadline
        ? new Date(summary.requirements.currentDeadline)
        : null,
    },
  });
}

function statusNeedsSync(user: ConnectUser, summary: ConnectStatusSummary): boolean {
  if (user.stripeOnboardingComplete !== summary.isComplete) return true;
  if (user.stripeAccountStatus !== summary.status) return true;
  const storedDue = Array.isArray(user.stripeRequirementsDue)
    ? (user.stripeRequirementsDue as string[])
    : [];
  const liveDue = summary.requirements.currentlyDue;
  if (storedDue.length !== liveDue.length) return true;
  return storedDue.some((field, i) => field !== liveDue[i]);
}

function isMissingAccountError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { statusCode?: number; code?: string; type?: string };
  return e.statusCode === 404 || e.code === "account_invalid" || e.code === "resource_missing";
}

/**
 * Retrieve the connected account, or null when Stripe no longer has it (in
 * which case the stale ID is cleared from the user). Other errors propagate.
 */
export async function retrieveConnectAccount(
  userId: string,
  accountId: string
): Promise<Stripe.Account | null> {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if ((account as unknown as { deleted?: boolean }).deleted) {
      console.info(`[Stripe Connect] Account ${accountId} was deleted in Stripe, clearing`);
      await clearConnectAccount(userId, accountId);
      return null;
    }
    return account;
  } catch (error) {
    if (isMissingAccountError(error)) {
      console.warn(`[Stripe Connect] Account ${accountId} not found in Stripe, clearing`);
      await clearConnectAccount(userId, accountId);
      return null;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Account creation
// ---------------------------------------------------------------------------

/**
 * The business profile every seller account carries. Sellers are private
 * individuals with no site of their own, so the URL is the marketplace itself
 * (there is no public per-seller page to point at). Used at creation and
 * re-sent by the details route, so the two can never drift.
 */
export function sellerBusinessProfile(): Stripe.AccountCreateParams.BusinessProfile {
  return {
    mcc: "5941", // Sporting goods
    url: getBaseUrl(),
    product_description: "Second-hand golf equipment sold on the ButterGolf marketplace",
  };
}

export interface EnsureConnectAccountOptions {
  /** Our User.id (not the Clerk ID). */
  userId: string;
  /**
   * Evidence of the user's acceptance of our terms, taken from a request they
   * made themselves. Pass it whenever you have a Request; without it the
   * account is created and Stripe lists tos_acceptance as due, which the
   * details step then satisfies.
   */
  tos?: TosAcceptanceEvidence;
}

/**
 * Return the user's Connect account ID, creating the account if they have
 * none (or if the one on file no longer exists in Stripe). Idempotent; safe to
 * call from the publish path and from every setup route.
 */
export async function ensureConnectAccount({
  userId,
  tos,
}: EnsureConnectAccountOptions): Promise<string> {
  const user = await loadConnectUser(userId);
  if (!user) throw new Error(`[Stripe Connect] User ${userId} not found`);

  if (user.stripeConnectId) {
    const existing = await retrieveConnectAccount(user.id, user.stripeConnectId);
    if (existing) return existing.id;
  }

  const address = user.addresses[0];
  const hasFullAddress = Boolean(address?.street1 && address?.city && address?.zip);

  const account = await stripe.accounts.create({
    country: "GB",
    email: user.email || undefined,
    // Sellers only ever receive transfers from the platform; buyers pay the
    // platform directly. Requesting card_payments would add requirements
    // (MCC, email) for a capability nobody uses.
    capabilities: {
      transfers: { requested: true },
    },
    controller: {
      // No Stripe Dashboard for sellers.
      stripe_dashboard: { type: "none" },
      // We collect requirements ourselves, which is what lets us accept the
      // Stripe agreement inside our own terms and skip Stripe user auth.
      requirement_collection: "application",
      // Platform bears negative balances (required with the above).
      losses: { payments: "application" },
      // Platform pays Stripe fees.
      fees: { payer: "application" },
    },
    business_type: "individual",
    individual: {
      first_name: user.firstName || undefined,
      last_name: user.lastName || undefined,
      email: user.email || undefined,
      phone: user.phone || undefined,
      ...(hasFullAddress && address
        ? {
            address: {
              line1: address.street1,
              ...(address.street2 ? { line2: address.street2 } : {}),
              city: address.city,
              postal_code: address.zip,
              country: "GB",
            },
          }
        : {}),
    },
    business_profile: sellerBusinessProfile(),
    settings: {
      payouts: {
        schedule: { interval: "daily" },
      },
    },
    ...(tosAcceptanceParams(tos) ? { tos_acceptance: tosAcceptanceParams(tos) } : {}),
    metadata: {
      userId: user.id,
      clerkId: user.clerkId,
    },
  });

  // Publishing a listing and opening payout setup can overlap while the user
  // still has no account, and both callers will reach this point. Only the
  // first to write wins; the loser discards the account it just made so the
  // seller's details never end up split across two.
  const claimed = await prisma.user.updateMany({
    where: { id: user.id, stripeConnectId: null },
    data: {
      stripeConnectId: account.id,
      stripeAccountType: "platform_managed",
      stripeOnboardingComplete: false,
      stripeAccountStatus: "pending",
    },
  });

  if (claimed.count === 0) {
    const winner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeConnectId: true },
    });
    if (winner?.stripeConnectId && winner.stripeConnectId !== account.id) {
      console.warn(
        `[Stripe Connect] Lost creation race for user ${user.id}: keeping ${winner.stripeConnectId}, deleting ${account.id}`
      );
      await stripe.accounts.del(account.id).catch((error) => {
        console.error(`[Stripe Connect] Could not delete orphaned account ${account.id}:`, error);
      });
      return winner.stripeConnectId;
    }
  }

  console.info(`[Stripe Connect] Created account ${account.id} for user ${user.id}`);
  return account.id;
}

/**
 * Non-blocking variant for the listing publish path. Runs after the response
 * is sent via Next's `after()`, which keeps the serverless invocation alive
 * until the work finishes — a detached promise would be cut off on Vercel the
 * moment the response went out, leaving a Stripe account with no row pointing
 * at it. Never throws; a failure just means the account is created later when
 * the seller opens payout setup. Must be called from a request scope (a route
 * handler or server action).
 */
export function ensureConnectAccountInBackground(options: EnsureConnectAccountOptions): void {
  after(async () => {
    try {
      await ensureConnectAccount(options);
    } catch (error) {
      console.error(
        `[Stripe Connect] Background account creation failed for user ${options.userId}:`,
        error
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Status for a user
// ---------------------------------------------------------------------------

/**
 * Live payout status for a user, synced to the database. Reads Stripe every
 * time — webhooks can lag or be missed, and this is what the UI polls.
 */
export async function getConnectStatusForUser(userId: string): Promise<PayoutStatus> {
  const user = await loadConnectUser(userId);
  if (!user) throw new Error(`[Stripe Connect] User ${userId} not found`);

  if (!user.stripeConnectId) {
    return noPayoutAccountStatus(buildPrefill(user, false));
  }

  const account = await retrieveConnectAccount(user.id, user.stripeConnectId);
  if (!account) {
    return noPayoutAccountStatus(buildPrefill(user, false));
  }

  const summary = deriveConnectStatus(account);
  if (statusNeedsSync(user, summary)) {
    console.info(
      `[Stripe Connect] Syncing user ${user.id}: status=${summary.status} complete=${summary.isComplete} due=${summary.requirements.currentlyDue.length}`
    );
    await syncConnectStatus(user.id, summary);
  }

  return buildPayoutStatus(summary, buildPrefill(user, summary.hasDob));
}

export function buildPayoutStatus(
  summary: ConnectStatusSummary,
  prefill: PayoutPrefill
): PayoutStatus {
  return {
    hasAccount: true,
    status: summary.status,
    isComplete: summary.isComplete,
    payoutsEnabled: summary.payoutsEnabled,
    transfersActive: summary.transfersActive,
    requirements: summary.requirements,
    needsDetails: summary.needsDetails,
    needsBankAccount: summary.needsBankAccount,
    needsVerification: summary.needsVerification,
    verificationFields: summary.verificationFields,
    bankAccount: summary.bankAccount,
    prefill,
  };
}

/** Resolve our User.id from a Clerk ID, or null when the webhook hasn't created them yet. */
export async function findUserIdByClerkId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  return user?.id ?? null;
}
