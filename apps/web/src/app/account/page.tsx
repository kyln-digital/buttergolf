import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { AccountSettingsClient } from "./_components/AccountSettingsClient";

export const dynamic = "force-dynamic";

/**
 * Account Settings Page
 *
 * Displays user account information and seller onboarding status.
 * Protected route - requires authentication.
 */
export default async function AccountPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch user data including Connect account status
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      stripeConnectId: true,
      stripeOnboardingComplete: true,
      stripeAccountStatus: true,
    },
  });

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <AccountSettingsClient
      user={{
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        phone: user.phone,
        hasConnectAccount: !!user.stripeConnectId,
        onboardingComplete: user.stripeOnboardingComplete || false,
        accountStatus: user.stripeAccountStatus || "none",
      }}
    />
  );
}
