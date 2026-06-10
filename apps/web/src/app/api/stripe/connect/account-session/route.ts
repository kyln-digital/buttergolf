import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/stripe/connect/account-session
 * Creates a new AccountSession for the fully embedded Connect components
 *
 * AccountSessions are short-lived (expires in ~1 hour) and provide
 * access to all embedded Connect components for the seller dashboard.
 *
 * Required components for Fully Embedded integration:
 * - account_onboarding: Initial seller onboarding
 * - account_management: Edit account settings
 * - notification_banner: Compliance/requirement notifications
 * - documents: Tax documents (required when Stripe owns pricing)
 * - payments: View transactions, handle disputes
 * - balances: View balance, add funds
 * - payouts: Manage payouts
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user - supports both web cookies and mobile Bearer tokens
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user's Connect account ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { stripeConnectId: true },
    });

    if (!user?.stripeConnectId) {
      return NextResponse.json(
        { error: "No Connect account found. Create an account first." },
        { status: 400 }
      );
    }

    // 3. Create AccountSession with ALL embedded components enabled
    // This enables the full seller dashboard experience
    const accountSession = await stripe.accountSessions.create({
      account: user.stripeConnectId,
      components: {
        // Onboarding - for initial account setup
        account_onboarding: { enabled: true },

        // Account Management - for editing account settings
        account_management: {
          enabled: true,
          features: {
            external_account_collection: true, // Allow bank account changes
          },
        },

        // Notification Banner - for compliance/requirement alerts
        notification_banner: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },

        // Documents - REQUIRED when Stripe owns pricing (fees_collector: "stripe")
        documents: { enabled: true },

        // Payments - view transactions, handle disputes/refunds
        payments: {
          enabled: true,
          features: {
            refund_management: true,
            dispute_management: true,
            capture_payments: true,
          },
        },

        // Balances - view balance, add funds to avoid negative balance
        balances: {
          enabled: true,
          features: {
            instant_payouts: true,
            standard_payouts: true,
            edit_payout_schedule: true,
          },
        },

        // Payouts - manage payout schedule and destination
        payouts: { enabled: true },

        // Payouts List - view payout history
        payouts_list: { enabled: true },
      },
    });

    // 4. Return client secret for embedded components
    return NextResponse.json({
      clientSecret: accountSession.client_secret,
      accountId: user.stripeConnectId,
    });
  } catch (error) {
    console.error("Error creating AccountSession:", error);

    return NextResponse.json(
      {
        error: "Failed to create AccountSession",
      },
      { status: 500 }
    );
  }
}
