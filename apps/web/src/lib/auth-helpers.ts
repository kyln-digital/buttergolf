import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";

/**
 * Get or create user from database
 *
 * This function implements the webhook + fallback pattern:
 * 1. Try to find user in database (should exist via Clerk webhook)
 * 2. If not found, create from Clerk API (fallback for webhook failures)
 *
 * Use this in any authenticated API route that needs the user's database record.
 *
 * @param clerkUserId - The Clerk user ID from auth()
 * @returns User record from database
 * @throws Error if user cannot be fetched or created
 */
export async function getOrCreateUser(clerkUserId: string) {
  // First, try to find existing user (normal case - webhook already synced)
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });

  if (user) {
    return user;
  }

  // User not found - webhook may not have fired yet or failed
  console.warn(
    `User ${clerkUserId} not found in database - creating from Clerk API (webhook fallback)`
  );

  // Fetch user details from Clerk
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("Unable to fetch user details from Clerk");
  }

  // Create user in database
  user = await prisma.user.create({
    data: {
      clerkId: clerkUserId,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      imageUrl: clerkUser.imageUrl,
    },
  });

  console.info(`Created user ${user.id} for Clerk ID ${clerkUserId} via fallback`);

  return user;
}
