import { NextResponse } from "next/server";
import { getConnectStatusForUser } from "@/lib/stripe-connect";
import { ensureDbUserFromRequest } from "@/lib/db-user";

/**
 * GET /api/stripe/connect/status
 *
 * The single source of truth for "where is this seller's payout setup".
 * Returns a `PayoutStatus` (see packages/constants/src/payouts.ts), read live
 * from Stripe and synced to our database on the way through.
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
    console.error("[Stripe Connect] Failed to read payout status:", error);
    return NextResponse.json({ error: "Failed to fetch payout status" }, { status: 500 });
  }
}
