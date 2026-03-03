import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { AccountHubClient } from "./_components/AccountHubClient";

export const dynamic = "force-dynamic";

/**
 * Account Hub Page
 *
 * Main account management hub displaying user profile, shopping, selling,
 * and account settings. Mirrors mobile's AccountScreen design.
 * Protected route - requires authentication.
 */
export default async function AccountPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect=/account");
  }

  // First, get the user to get their DB id
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      imageUrl: true,
      stripeConnectId: true,
      stripeOnboardingComplete: true,
      stripeAccountStatus: true,
    },
  });

  if (!user) {
    redirect("/sign-in?redirect=/account");
  }

  // Fetch counts in parallel using the user's DB id
  const [clerkUserData, pendingOrdersCount, unreadMessagesCount, activeListingsCount] =
    await Promise.all([
      // Get Clerk user for profile image
      currentUser(),
      // Count pending orders (purchased items awaiting delivery)
      prisma.order.count({
        where: {
          buyerId: user.id,
          status: { in: ["PAYMENT_CONFIRMED", "LABEL_GENERATED", "SHIPPED"] },
        },
      }),
      // Count unread messages (messages in conversations where user is buyer or seller, from other party)
      prisma.message
        .count({
          where: {
            OR: [
              { conversation: { buyerId: user.id }, senderId: { not: user.id }, isRead: false },
              { conversation: { sellerId: user.id }, senderId: { not: user.id }, isRead: false },
            ],
          },
        })
        .catch(() => 0), // Gracefully handle if message schema doesn't exist yet
      // Count active listings (not sold, not draft)
      prisma.product.count({
        where: {
          userId: user.id,
          isSold: false,
          isDraft: false,
        },
      }),
    ]);

  return (
    <AccountHubClient
      user={{
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        phone: user.phone,
        imageUrl: clerkUserData?.imageUrl || user.imageUrl || undefined,
        hasConnectAccount: !!user.stripeConnectId,
        onboardingComplete: user.stripeOnboardingComplete || false,
        accountStatus: user.stripeAccountStatus || "none",
      }}
      pendingOrdersCount={pendingOrdersCount}
      unreadMessagesCount={unreadMessagesCount}
      activeListingsCount={activeListingsCount}
    />
  );
}
