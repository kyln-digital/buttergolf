import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { ensureDbUserFromRequest } from "@/lib/db-user";

/**
 * GET /api/stripe/connect/payouts
 *
 * Balance and recent payouts for the seller's money page, read from their
 * connected account. Sellers have no Stripe Dashboard, so this is the only
 * place they can see what is on its way to their bank.
 *
 * Everything is GBP: accounts are created with country "GB" and the platform
 * only ever transfers gbp.
 */

const PAYOUT_CURRENCY = "gbp";
const PAYOUT_LIMIT = 20;

interface PayoutSummary {
  id: string;
  amountPence: number;
  currency: string;
  status: string;
  arrivalDate: string;
  createdAt: string;
  destinationLast4: string | null;
  failureMessage: string | null;
}

interface PayoutsResponse {
  hasAccount: boolean;
  currency: typeof PAYOUT_CURRENCY;
  balance: { availablePence: number; pendingPence: number } | null;
  payouts: PayoutSummary[];
}

const NO_ACCOUNT: PayoutsResponse = {
  hasAccount: false,
  currency: PAYOUT_CURRENCY,
  balance: null,
  payouts: [],
};

export async function GET(request: Request) {
  try {
    const dbUser = await ensureDbUserFromRequest(request);
    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: { stripeConnectId: true },
    });

    if (!user?.stripeConnectId) {
      return NextResponse.json(NO_ACCOUNT);
    }

    const stripeAccount = user.stripeConnectId;

    const [balance, payouts] = await Promise.all([
      stripe.balance.retrieve({}, { stripeAccount }),
      stripe.payouts.list({ limit: PAYOUT_LIMIT, expand: ["data.destination"] }, { stripeAccount }),
    ]);

    const response: PayoutsResponse = {
      hasAccount: true,
      currency: PAYOUT_CURRENCY,
      balance: {
        availablePence: sumGbp(balance.available),
        pendingPence: sumGbp(balance.pending),
      },
      payouts: payouts.data.map(toPayoutSummary),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Stripe Connect] Failed to fetch payouts:", error);
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}

function sumGbp(entries: Stripe.Balance.Available[] | Stripe.Balance.Pending[]): number {
  return entries
    .filter((entry) => entry.currency === PAYOUT_CURRENCY)
    .reduce((total, entry) => total + entry.amount, 0);
}

function toPayoutSummary(payout: Stripe.Payout): PayoutSummary {
  return {
    id: payout.id,
    amountPence: payout.amount,
    currency: payout.currency,
    status: payout.status,
    arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
    createdAt: new Date(payout.created * 1000).toISOString(),
    destinationLast4: destinationLast4(payout.destination),
    failureMessage: payout.failure_message ?? null,
  };
}

function destinationLast4(destination: Stripe.Payout["destination"]): string | null {
  if (!destination || typeof destination === "string") return null;
  if ("last4" in destination && typeof destination.last4 === "string") return destination.last4;
  return null;
}
