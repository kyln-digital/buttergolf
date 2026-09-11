import { prisma } from "@buttergolf/db";
import { getClerkUserFromRequest } from "@/lib/auth";

/**
 * Our `User` row for whoever made this request.
 *
 * Authentication goes through `getClerkUserFromRequest`, so web cookies,
 * Clerk Bearer tokens (mobile) and the short-lived WebView session tokens all
 * work. The row is upserted from Clerk data when the Clerk webhook hasn't
 * created it yet — which happens routinely in local development and whenever
 * webhook delivery lags a fresh sign-up.
 *
 * Returns null when the request is unauthenticated, and also when Clerk gave
 * us no email to create the row with (rare, and nothing downstream can do
 * anything useful without it).
 */

const DB_USER_SELECT = { id: true, clerkId: true } as const;

export interface DbUserRef {
  id: string;
  clerkId: string;
}

export async function ensureDbUserFromRequest(request: Request): Promise<DbUserRef | null> {
  const clerkUser = await getClerkUserFromRequest(request);
  if (!clerkUser) return null;

  const clerkId = clerkUser.userId;

  const existing = await prisma.user.findUnique({
    where: { clerkId },
    select: { ...DB_USER_SELECT, email: true },
  });

  if (existing) {
    // The row can exist with empty details when an older code path created it
    // before Clerk data was available. Backfill so payout prefill has names.
    if ((!existing.email || existing.email === "") && clerkUser.email) {
      console.info(`[DB User] Backfilling Clerk data onto user ${existing.id}`);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: clerkUser.email,
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
        },
      });
    }
    return { id: existing.id, clerkId: existing.clerkId };
  }

  if (!clerkUser.email) {
    console.warn(`[DB User] Cannot create user for clerkId ${clerkId}: no email from Clerk`);
    return null;
  }

  // upsert is atomic, so concurrent requests for the same new user can't
  // create two rows.
  console.info(`[DB User] User not found, upserting from Clerk data: ${clerkId}`);
  try {
    const created = await prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email: clerkUser.email,
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
      },
      update: {}, // Never clobber a row another request just created.
      select: DB_USER_SELECT,
    });
    return created;
  } catch (error) {
    // P2002 = unique constraint violation, from one of two causes:
    //   1. a concurrent request created the row first (recoverable — re-read)
    //   2. the email already belongs to a different clerkId (not recoverable)
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      console.warn(`[DB User] Unique constraint violation for clerkId ${clerkId}, re-fetching`);
      const raced = await prisma.user.findUnique({
        where: { clerkId },
        select: DB_USER_SELECT,
      });
      if (raced) return raced;
      console.error(`[DB User] Email conflict for clerkId ${clerkId} — email used by another user`);
      return null;
    }
    throw error;
  }
}
