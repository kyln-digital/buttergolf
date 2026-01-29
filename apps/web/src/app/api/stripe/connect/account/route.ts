import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest, getClerkUserFromRequest } from "@/lib/auth";

/**
 * POST /api/stripe/connect/account
 * Creates or retrieves a Stripe Connect account for the authenticated user
 * Returns an account session client_secret for embedded onboarding
 *
 * Uses V1 API with controller settings for fully embedded experience:
 * - controller.stripe_dashboard.type = "none" (no Stripe Dashboard access)
 * - Stripe manages risk and compliance
 * - All account management through embedded components
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user - supports both web cookies and mobile Bearer tokens
    // Use getClerkUserFromRequest to get full profile data for prefilling
    const userData = await getClerkUserFromRequest(request);
    if (!userData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.userId;

    // 2. Get user from database (or create if webhook hasn't fired yet)
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    // If user doesn't exist, the Clerk webhook hasn't fired yet
    // Create a user record with data from Clerk so onboarding is prefilled
    // Use upsert to handle race conditions where concurrent requests try to create the same user
    if (!user && userData.email) {
      console.log(
        `[Stripe Connect] User not found for clerkId ${userId}, upserting from Clerk data`
      );
      user = await prisma.user.upsert({
        where: { clerkId: userId },
        create: {
          clerkId: userId,
          email: userData.email,
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
        },
        update: {}, // Don't update if user was created by another concurrent request
      });
      console.log(
        `[Stripe Connect] Upserted user record ${user.id} for clerkId ${userId} with Clerk data`
      );
    } else if (!user) {
      // No email available from Clerk - cannot create user record safely
      // This is rare (Clerk usually provides email) but we handle it gracefully
      console.warn(
        `[Stripe Connect] Cannot create user for clerkId ${userId}: no email available from Clerk`
      );
      return NextResponse.json(
        { error: "User profile incomplete - please ensure your account has an email address" },
        { status: 400 }
      );
    } else if ((!user.email || user.email === "") && userData.email) {
      // User exists but with empty data (created before we had Clerk data)
      // Update with Clerk data now that we have it
      console.log(`[Stripe Connect] Updating user ${user.id} with Clerk data`);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: userData.email,
          firstName: userData.firstName || user.firstName || "",
          lastName: userData.lastName || user.lastName || "",
        },
      });
    }

    let stripeAccountId = user.stripeConnectId;

    // 3. Verify existing account still exists in Stripe, or create new one
    if (stripeAccountId) {
      try {
        // Verify the account exists in Stripe
        const existingAccount = await stripe.accounts.retrieve(stripeAccountId);
        console.log(
          `[Stripe Connect] Verified existing account ${stripeAccountId} for user ${user.id}`
        );

        // Check if account was deleted from Stripe
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((existingAccount as any).deleted) {
          console.log(
            `[Stripe Connect] Account ${stripeAccountId} was deleted in Stripe, clearing from database`
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
        // Account doesn't exist in Stripe (404) or other error
        console.error(`[Stripe Connect] Error retrieving account ${stripeAccountId}:`, error);
        console.log(
          `[Stripe Connect] Clearing invalid stripeConnectId from database for user ${user.id}`
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

    // 4. Create NEW Stripe Connect account if needed (using V1 API)
    if (!stripeAccountId) {
      // Use controller settings for fully embedded experience
      // Note: Do NOT use `type` when using `controller` - they are mutually exclusive
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
          // Platform controls requirement collection via embedded components
          requirement_collection: "application",
          // Platform is liable for negative balances (chargebacks, fraud)
          // Required when requirement_collection is "application"
          losses: {
            payments: "application",
          },
          // Platform pays Stripe fees and charges sellers via application_fee
          // Required when requirement_collection is "application"
          fees: {
            payer: "application",
          },
        },
        business_type: "individual",
        // Pre-populate individual details from our database
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
        },
      });

      stripeAccountId = account.id;
      console.log(`[Stripe Connect] Created new account ${stripeAccountId} for user ${user.id}`);

      // Save to database IMMEDIATELY - so we can clean up even if onboarding is abandoned
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectId: stripeAccountId,
          stripeAccountType: "fully_embedded",
        },
      });
      console.log(`[Stripe Connect] Saved stripeConnectId to database for user ${user.id}`);
    }

    // 5. Create AccountSession for embedded onboarding
    // AccountSession provides a client_secret for the frontend embedded component
    const accountSession = await stripe.accountSessions.create({
      account: stripeAccountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: {
            // Enable external account collection for payouts
            external_account_collection: true,
            // Disable Stripe user authentication - keeps everything inline/embedded
            // This is allowed because controller.requirement_collection = "application"
            disable_stripe_user_authentication: true,
          },
        },
      },
    });

    // 6. Return the client secret for the embedded component
    return NextResponse.json({
      clientSecret: accountSession.client_secret,
      accountId: stripeAccountId,
    });
  } catch (error) {
    console.error("Error creating Stripe Connect account:", error);

    return NextResponse.json(
      {
        error: "Failed to create Connect account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/connect/account
 * Returns the current user's Connect account status
 *
 * IMPORTANT: This endpoint syncs the database with Stripe's current status.
 * This is critical because webhooks may be delayed or missed, so we can't
 * rely solely on webhook-driven updates for accurate seller status.
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
      });
    }

    // If user has Connect account, fetch latest status from Stripe
    if (user.stripeConnectId) {
      const account = await stripe.accounts.retrieve(user.stripeConnectId);

      // Calculate the current status from Stripe's live data
      const onboardingComplete = account.details_submitted ?? false;
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;

      // Determine account status
      let accountStatus = "pending";
      if (onboardingComplete && chargesEnabled && payoutsEnabled) {
        accountStatus = "active";
      } else if (onboardingComplete) {
        accountStatus = "restricted";
      }

      // CRITICAL: Sync database with Stripe's current status
      // This ensures the database is always up-to-date, even if webhooks are delayed
      const dbNeedsUpdate =
        user.stripeOnboardingComplete !== onboardingComplete ||
        user.stripeAccountStatus !== accountStatus;

      if (dbNeedsUpdate) {
        console.log(
          `[Stripe Connect] Syncing database for user ${user.id}: onboardingComplete=${onboardingComplete}, status=${accountStatus}`
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
        accountId: user.stripeConnectId,
        onboardingComplete,
        chargesEnabled,
        payoutsEnabled,
        requirements: account.requirements,
      });
    }

    return NextResponse.json({
      hasAccount: false,
    });
  } catch (error) {
    console.error("Error fetching Connect account status:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch account status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
