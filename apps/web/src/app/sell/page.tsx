import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";
import { SellOnboardingGate } from "./_components/SellOnboardingGate";
import { SellFormClient } from "./_components/SellFormClient";

/**
 * Sell Page - Server Component
 *
 * This page handles the complete seller journey:
 * 1. Auth check - redirects to sign-in if not authenticated
 * 2. Seller status check - fetches Stripe Connect status from database
 * 3. Onboarding gate - shows embedded onboarding if needed
 * 4. Sell form - shows the product listing form once ready
 *
 * Zero-touch flow: Users automatically start onboarding when they first
 * visit /sell, no need to click "Become a Seller" anywhere.
 */
export default async function SellPage() {
  // 1. Check authentication
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in?redirect=/sell");
  }

  // 2. Fetch user and seller status from database
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      phone: true,
      stripeConnectId: true,
      stripeOnboardingComplete: true,
      stripeAccountStatus: true,
      stripeRequirementsDue: true,
    },
  });

  // Calculate requirements count from the JSON field
  let requirementsCount = 0;
  if (user?.stripeRequirementsDue) {
    const requirements = user.stripeRequirementsDue as {
      currently_due?: string[];
    };
    requirementsCount = requirements.currently_due?.length ?? 0;
  }

  // Build seller status object for the gate component
  const sellerStatus = {
    hasAccount: !!user?.stripeConnectId,
    onboardingComplete: user?.stripeOnboardingComplete ?? false,
    accountStatus: user?.stripeAccountStatus ?? null,
    requirementsCount,
    phone: user?.phone ?? null,
  };

  // 3. Render with onboarding gate
  // The gate will show onboarding if needed, otherwise shows children
  return (
    <SellOnboardingGate initialStatus={sellerStatus}>
      <SellFormClient />
    </SellOnboardingGate>
  );
}
