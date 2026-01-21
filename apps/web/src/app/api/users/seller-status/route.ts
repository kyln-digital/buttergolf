import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/users/seller-status
 * Returns the current user's seller/Stripe Connect status.
 *
 * This endpoint is optimized for quick status checks without creating
 * or modifying accounts. It syncs the database with Stripe's current
 * status if a Connect account exists.
 *
 * Response:
 * - hasAccount: boolean - Whether user has a Stripe Connect account
 * - onboardingComplete: boolean - Whether onboarding is finished
 * - isReadyToSell: boolean - Whether user can create listings
 * - accountStatus: "pending" | "active" | "restricted" | null
 * - chargesEnabled: boolean - Can accept payments
 * - payoutsEnabled: boolean - Can receive payouts
 */
export async function GET(request: Request) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        stripeConnectId: true,
        stripeOnboardingComplete: true,
        stripeAccountStatus: true,
      },
    });

    // If user doesn't exist yet (webhook race condition), return no account
    if (!user) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        isReadyToSell: false,
        accountStatus: null,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // If user has no Connect account
    if (!user.stripeConnectId) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        isReadyToSell: false,
        accountStatus: null,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // Fetch latest status from Stripe
    try {
      const account = await stripe.accounts.retrieve(user.stripeConnectId);

      // Calculate the current status from Stripe's live data
      const onboardingComplete = account.details_submitted ?? false;
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;

      // Determine account status
      let accountStatus: "pending" | "active" | "restricted" = "pending";
      if (onboardingComplete && chargesEnabled && payoutsEnabled) {
        accountStatus = "active";
      } else if (onboardingComplete) {
        accountStatus = "restricted";
      }

      // User is ready to sell if onboarding is complete and charges are enabled
      const isReadyToSell = onboardingComplete && chargesEnabled;

      // Sync database with Stripe's current status if needed
      const dbNeedsUpdate =
        user.stripeOnboardingComplete !== onboardingComplete ||
        user.stripeAccountStatus !== accountStatus;

      if (dbNeedsUpdate) {
        console.log(
          `[Seller Status] Syncing database for user ${user.id}: onboardingComplete=${onboardingComplete}, status=${accountStatus}`
        );
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeOnboardingComplete: onboardingComplete,
            stripeAccountStatus: accountStatus,
          },
        });
      }

      return NextResponse.json({
        hasAccount: true,
        onboardingComplete,
        isReadyToSell,
        accountStatus,
        chargesEnabled,
        payoutsEnabled,
        requirements: account.requirements?.currently_due || [],
      });
    } catch (stripeError) {
      // Account may have been deleted or is invalid
      console.error(
        `[Seller Status] Error retrieving Stripe account ${user.stripeConnectId}:`,
        stripeError
      );

      // Clear invalid account from database (including all Stripe-related fields)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectId: null,
          stripeOnboardingComplete: false,
          stripeAccountStatus: null,
          stripeAccountType: null,
          stripeRequirementsDeadline: null,
          stripeRequirementsDue: null,
        },
      });

      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        isReadyToSell: false,
        accountStatus: null,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }
  } catch (error) {
    console.error("[Seller Status] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch seller status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
