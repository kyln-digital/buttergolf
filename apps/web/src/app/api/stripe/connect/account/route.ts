import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ensureDbUserFromRequest } from "@/lib/db-user";
import {
  ensureConnectAccount,
  getConnectStatusForUser,
  getTosEvidenceFromRequest,
} from "@/lib/stripe-connect";

/**
 * POST /api/stripe/connect/account
 *
 * Creates an AccountSession for Stripe's embedded onboarding component.
 *
 * This is now a *fallback* surface only. ButterGolf collects name, date of
 * birth, address, phone and bank details in its own form
 * (/api/stripe/connect/setup/*); the embedded component exists for the
 * requirements Stripe will only accept through its own UI — identity
 * documents and proof of liveness. Callers should restrict it with
 * `collectionOptions.requirements.only` using `PayoutStatus.verificationFields`.
 *
 * Account creation itself lives in `@/lib/stripe-connect` and is shared with
 * the listing-publish path, so this route never creates one itself.
 *
 * Returns: { clientSecret, accountId }
 */
export async function POST(request: Request) {
  try {
    const user = await ensureDbUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = await ensureConnectAccount({
      userId: user.id,
      tos: getTosEvidenceFromRequest(request),
    });

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: {
            external_account_collection: true,
            // Allowed because controller.requirement_collection is
            // "application": the seller never authenticates with Stripe.
            disable_stripe_user_authentication: true,
          },
        },
      },
    });

    return NextResponse.json({
      clientSecret: accountSession.client_secret,
      accountId,
    });
  } catch (error) {
    console.error("[Stripe Connect] Failed to create account session:", error);
    return NextResponse.json({ error: "Failed to create Connect account" }, { status: 500 });
  }
}

/**
 * GET /api/stripe/connect/account
 *
 * Identical to GET /api/stripe/connect/status — one derivation of payout
 * state, kept here so existing callers don't break.
 */
export async function GET(request: Request) {
  try {
    const user = await ensureDbUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getConnectStatusForUser(user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[Stripe Connect] Failed to fetch account status:", error);
    return NextResponse.json({ error: "Failed to fetch account status" }, { status: 500 });
  }
}
