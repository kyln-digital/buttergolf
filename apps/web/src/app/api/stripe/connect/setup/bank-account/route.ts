import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ensureDbUserFromRequest } from "@/lib/db-user";
import { readJsonObject } from "@/lib/json-body";
import {
  describeStripeInputError,
  ensureConnectAccount,
  getConnectStatusForUser,
  getTosEvidenceFromRequest,
} from "@/lib/stripe-connect";

/**
 * POST /api/stripe/connect/setup/bank-account
 *
 * Step two of our own payout form. The sort code and account number are
 * tokenised in the client with Stripe.js / the Stripe SDK, so raw bank details
 * never reach our server — we only ever see the resulting `btok_…`.
 *
 * Body: { token: string }
 * Returns: the fresh PayoutStatus, or 400 { error, param } when Stripe rejects
 * the token.
 *
 * Attaching a new external account replaces the connected account's default
 * GBP bank account, so this doubles as "change my bank details".
 */
export async function POST(request: Request) {
  try {
    const user = await ensureDbUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonObject(request);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token.startsWith("btok_")) {
      return NextResponse.json({ error: "Enter your bank details again" }, { status: 400 });
    }

    const accountId = await ensureConnectAccount({
      userId: user.id,
      tos: getTosEvidenceFromRequest(request),
    });

    try {
      await stripe.accounts.update(accountId, { external_account: token });
    } catch (stripeError) {
      const described = describeStripeInputError(stripeError);
      if (described) {
        console.warn(`[Stripe Connect] Rejected bank account for user ${user.id}:`, described);
        return NextResponse.json(
          { error: described.message, param: described.param },
          { status: 400 }
        );
      }
      throw stripeError;
    }

    const status = await getConnectStatusForUser(user.id);
    console.info(
      `[Stripe Connect] Attached bank account for user ${user.id}: status=${status.status}`
    );
    return NextResponse.json(status);
  } catch (error) {
    console.error("[Stripe Connect] Failed to attach bank account:", error);
    return NextResponse.json({ error: "Failed to save your bank details" }, { status: 500 });
  }
}
