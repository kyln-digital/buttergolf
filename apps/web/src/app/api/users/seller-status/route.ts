import { NextResponse } from "next/server";
import { getConnectStatusForUser } from "@/lib/stripe-connect";
import { ensureDbUserFromRequest } from "@/lib/db-user";

/**
 * GET /api/users/seller-status
 *
 * The mobile app's view of payout readiness. It derives from the same
 * `PayoutStatus` as /api/stripe/connect/status; the flat keys below are kept
 * for app binaries already in the wild, with the whole status nested under
 * `payoutStatus` for newer callers.
 *
 * Response:
 * - hasAccount         a Connect account exists
 * - onboardingComplete payouts enabled + transfers active + nothing due
 * - isReadyToSell      same as onboardingComplete (listing never needs Stripe)
 * - accountStatus      "none" | "pending" | "active" | "restricted" | "rejected"
 * - chargesEnabled     now means "transfers capability active" — sellers only
 *                      ever receive transfers, they take no card payments
 * - payoutsEnabled     Stripe's payouts_enabled
 * - requirements       currently-due requirement names
 * - payoutStatus       the full PayoutStatus
 */
export async function GET(request: Request) {
  try {
    const user = await ensureDbUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payoutStatus = await getConnectStatusForUser(user.id);

    return NextResponse.json({
      hasAccount: payoutStatus.hasAccount,
      onboardingComplete: payoutStatus.isComplete,
      isReadyToSell: payoutStatus.isComplete,
      accountStatus: payoutStatus.status,
      chargesEnabled: payoutStatus.transfersActive,
      payoutsEnabled: payoutStatus.payoutsEnabled,
      requirements: payoutStatus.requirements.currentlyDue,
      payoutStatus,
    });
  } catch (error) {
    console.error("[Seller Status] Error:", error);
    return NextResponse.json({ error: "Failed to fetch seller status" }, { status: 500 });
  }
}
