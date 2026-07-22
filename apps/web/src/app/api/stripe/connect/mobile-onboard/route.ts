import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * @deprecated This endpoint is no longer used as of the migration to embedded Stripe Connect.
 * Mobile now uses the unified /api/stripe/connect/account endpoint with native embedded components.
 * This file is kept for backwards compatibility but can be safely removed in a future release.
 *
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
      console.info(
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
      console.info(`[Stripe Mobile Onboard] Created user record ${user.id} for clerkId ${userId}`);
    }

    let stripeAccountId = user.stripeConnectId;

    // 3. Verify existing account still exists in Stripe, or create new one
    if (stripeAccountId) {
      try {
        const existingAccount = await stripe.accounts.retrieve(stripeAccountId);
        console.info(
          `[Stripe Mobile Onboard] Verified existing account ${stripeAccountId} for user ${user.id}`
        );

        // Check if account was deleted from Stripe
        // @ts-expect-error - Stripe API may return 'deleted: true' on deleted accounts, but this isn't in the TypeScript types
        if (existingAccount.deleted) {
          console.info(
            `[Stripe Mobile Onboard] Account ${stripeAccountId} was deleted, clearing from database`
          );
          stripeAccountId = null;
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
            stripeAccountType: null,
            stripeRequirementsDeadline: null,
            stripeRequirementsDue: null,
          },
        });
      }
    }

    // 4. Create NEW Stripe Connect account if needed
    // Use same account type as web (controller-based) for consistency
    // Mobile uses hosted onboarding via account links, but same account structure
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        country: "GB",
        email: user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        controller: {
          // Fully embedded - no Stripe Dashboard access for connected accounts
          stripe_dashboard: {
            type: "none",
          },
          // Platform controls requirement collection
          requirement_collection: "application",
          // Platform is liable for negative balances (chargebacks, fraud)
          losses: {
            payments: "application",
          },
          // Platform pays Stripe fees and charges sellers via application_fee
          fees: {
            payer: "application",
          },
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
      console.info(
        `[Stripe Mobile Onboard] Created new account ${stripeAccountId} for user ${user.id}`
      );

      // Save to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectId: stripeAccountId,
          stripeAccountType: "fully_embedded",
        },
      });
    }

    // 5. Create Account Link for hosted onboarding
    // Stripe requires HTTPS URLs, so we use web pages that redirect to deep links
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.buttergolf.com";
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/seller/onboarding/refresh`,
      return_url: `${baseUrl}/seller/onboarding/complete`,
      type: "account_onboarding",
      collect: "currently_due",
    });

    console.info(
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
      },
      { status: 500 }
    );
  }
}
