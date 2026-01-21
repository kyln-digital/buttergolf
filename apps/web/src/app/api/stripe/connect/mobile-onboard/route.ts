import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/stripe/connect/mobile-onboard
 * Creates or retrieves a Stripe Connect account and returns an account link URL
 * for mobile app onboarding via Stripe's hosted onboarding flow.
 *
 * Mobile apps cannot use embedded Connect components (@stripe/react-connect-js),
 * so we use Stripe's hosted onboarding with account links that redirect back
 * to the app via deep links.
 *
 * Flow:
 * 1. Create/retrieve Stripe Connect account
 * 2. Generate account link URL with deep link return URLs
 * 3. Mobile app opens URL in WebBrowser/AuthSession
 * 4. User completes Stripe onboarding
 * 5. Stripe redirects to buttergolf://seller/onboarding/complete
 * 6. Mobile app refreshes seller status
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user - supports both web cookies and mobile Bearer tokens
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user from database (or create if webhook hasn't fired yet)
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    // If user doesn't exist, the Clerk webhook hasn't fired yet
    // Create a minimal user record so they can proceed with onboarding
    if (!user) {
      console.log(
        `[Stripe Mobile Onboard] User not found for clerkId ${userId}, creating minimal record`
      );
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email: "",
          firstName: "",
          lastName: "",
        },
      });
      console.log(
        `[Stripe Mobile Onboard] Created user record ${user.id} for clerkId ${userId}`
      );
    }

    let stripeAccountId = user.stripeConnectId;

    // 3. Verify existing account still exists in Stripe, or create new one
    if (stripeAccountId) {
      try {
        const existingAccount = await stripe.accounts.retrieve(stripeAccountId);
        console.log(
          `[Stripe Mobile Onboard] Verified existing account ${stripeAccountId} for user ${user.id}`
        );

        // Check if account was deleted from Stripe
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((existingAccount as any).deleted) {
          console.log(
            `[Stripe Mobile Onboard] Account ${stripeAccountId} was deleted, clearing from database`
          );
          stripeAccountId = null;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeConnectId: null,
              stripeOnboardingComplete: false,
              stripeAccountStatus: null,
            },
          });
        }
      } catch (error) {
        console.error(
          `[Stripe Mobile Onboard] Error retrieving account ${stripeAccountId}:`,
          error
        );
        stripeAccountId = null;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeConnectId: null,
            stripeOnboardingComplete: false,
            stripeAccountStatus: null,
          },
        });
      }
    }

    // 4. Create NEW Stripe Connect account if needed
    // For mobile, we use Express accounts with hosted onboarding
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        individual: {
          first_name: user.firstName || undefined,
          last_name: user.lastName || undefined,
          email: user.email || undefined,
        },
        business_profile: {
          mcc: "5941", // Sporting goods
          product_description: "Golf equipment marketplace seller",
        },
        settings: {
          payouts: {
            schedule: {
              interval: "daily",
            },
          },
        },
        metadata: {
          userId: user.id,
          clerkId: userId,
          source: "mobile",
        },
      });

      stripeAccountId = account.id;
      console.log(
        `[Stripe Mobile Onboard] Created new Express account ${stripeAccountId} for user ${user.id}`
      );

      // Save to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectId: stripeAccountId,
          stripeAccountType: "express",
        },
      });
    }

    // 5. Create Account Link for hosted onboarding
    // Deep link URLs for return to app
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: "buttergolf://seller/onboarding/refresh",
      return_url: "buttergolf://seller/onboarding/complete",
      type: "account_onboarding",
      collect: "eventually_due",
    });

    console.log(
      `[Stripe Mobile Onboard] Created account link for ${stripeAccountId}, expires: ${new Date(accountLink.expires_at * 1000).toISOString()}`
    );

    // 6. Return the onboarding URL
    return NextResponse.json({
      url: accountLink.url,
      accountId: stripeAccountId,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error("[Stripe Mobile Onboard] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to create onboarding link",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
