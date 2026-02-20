#!/usr/bin/env npx tsx

/**
 * Reset Stripe Onboarding Status
 *
 * This script resets a user's Stripe Connect onboarding status for testing:
 * 1. Deletes their Stripe Connect account via Stripe API
 * 2. Clears stripe-related fields in the database
 *
 * Usage:
 *   pnpm reset-stripe
 *
 * Or manually:
 *   cd apps/web && npx tsx ../../scripts/reset-stripe-onboarding.ts
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { resolve } from "path";

// Load env from web app
config({ path: resolve(__dirname, "../apps/web/.env.local") });
config({ path: resolve(__dirname, "../apps/web/.env") });

// Target email to reset
const TARGET_EMAIL = "josh@rwxt.org";

async function main() {
  // Dynamically import prisma to ensure it resolves correctly
  const { prisma } = await import("@buttergolf/db");

  // Initialize Stripe with secret key from environment
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY environment variable is required");
    console.log("   Make sure apps/web/.env.local has STRIPE_SECRET_KEY set");
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-11-20.acacia",
  });

  console.log(`\n🔄 Resetting Stripe onboarding for: ${TARGET_EMAIL}\n`);

  // 1. Find user in database
  const user = await prisma.user.findFirst({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      email: true,
      stripeConnectId: true,
      stripeOnboardingComplete: true,
      stripeAccountStatus: true,
      stripeAccountType: true,
      phone: true,
    },
  });

  if (!user) {
    console.error(`User not found with email: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  console.log("Current user state:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Stripe Connect ID: ${user.stripeConnectId || "(none)"}`);
  console.log(`   Onboarding Complete: ${user.stripeOnboardingComplete}`);
  console.log(`   Account Status: ${user.stripeAccountStatus || "(none)"}`);
  console.log(`   Account Type: ${user.stripeAccountType || "(none)"}`);
  console.log(`   Phone: ${user.phone || "(none)"}`);
  console.log("");

  // 2. Delete Stripe Connect account if exists
  if (user.stripeConnectId) {
    console.log(`🗑️  Deleting Stripe Connect account: ${user.stripeConnectId}`);
    try {
      await stripe.accounts.del(user.stripeConnectId);
      console.log("   Stripe account deleted");
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") {
        console.log("   Account already deleted or doesn't exist in Stripe");
      } else {
        console.error("   Failed to delete Stripe account:", error);
        // Continue anyway to clear DB
      }
    }
  } else {
    console.log("ℹ️  No Stripe Connect account to delete");
  }

  // 3. Clear database fields
  console.log("\n🧹 Clearing database fields...");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeConnectId: null,
      stripeOnboardingComplete: false,
      stripeAccountStatus: null,
      stripeAccountType: null,
      phone: null, // Also clear phone so you can test phone collection
    },
  });
  console.log("   Database fields cleared");

  // 4. Verify reset
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      stripeConnectId: true,
      stripeOnboardingComplete: true,
      stripeAccountStatus: true,
      stripeAccountType: true,
      phone: true,
    },
  });

  console.log("\nReset complete! New state:");
  console.log(`   Stripe Connect ID: ${updatedUser?.stripeConnectId || "(none)"}`);
  console.log(`   Onboarding Complete: ${updatedUser?.stripeOnboardingComplete}`);
  console.log(`   Account Status: ${updatedUser?.stripeAccountStatus || "(none)"}`);
  console.log(`   Account Type: ${updatedUser?.stripeAccountType || "(none)"}`);
  console.log(`   Phone: ${updatedUser?.phone || "(none)"}`);
  console.log("\nYou can now test the onboarding flow at /sell\n");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Fatal error:", error);
  const { prisma } = await import("@buttergolf/db");
  await prisma.$disconnect();
  process.exit(1);
});
