import { NextResponse } from "next/server";
import { getClerkUserFromRequest } from "@/lib/auth";
import { createMobileSessionToken } from "@/lib/mobile-session";
import { prisma } from "@buttergolf/db";

/**
 * POST /api/stripe/connect/mobile-session
 *
 * Creates a short-lived JWT token for mobile WebView authentication.
 * The token includes user profile data (firstName, lastName, email) for form prefilling.
 *
 * IMPORTANT: This endpoint also syncs the user to the database from Clerk.
 * This is critical for local development where Clerk webhooks can't reach localhost,
 * and ensures user data is available for Stripe Connect prefilling.
 *
 * Security flow:
 * 1. Mobile app calls this endpoint with Clerk Bearer token
 * 2. This endpoint syncs user data to database (upsert)
 * 3. Returns a short-lived mobile session token (15 min expiry)
 * 4. Mobile app passes the session token to WebView via URL query param
 * 5. WebView uses the token to authenticate with /api/stripe/connect/account
 * 6. getUserIdFromRequest() verifies the mobile session token via verifyMobileSessionToken()
 *
 * This is more secure than passing Clerk tokens in URLs because:
 * - Short-lived (15 min vs Clerk's longer-lived tokens)
 * - Limited scope (only valid for onboarding flow)
 * - Not stored in browser history/logs with full Clerk privileges
 */
export async function POST(request: Request) {
  try {
    // Authenticate using Clerk Bearer token and get user profile data
    const userData = await getClerkUserFromRequest(request);
    if (!userData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Mobile Session] Creating token for user:", {
      userId: userData.userId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
    });

    // CRITICAL: Sync user to database from Clerk
    // This ensures user data is available for Stripe Connect prefilling
    // and handles the case where Clerk webhooks haven't fired (local dev)
    if (userData.email) {
      try {
        await prisma.user.upsert({
          where: { clerkId: userData.userId },
          update: {
            email: userData.email,
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
          },
          create: {
            clerkId: userData.userId,
            email: userData.email,
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
          },
        });
        console.log("[Mobile Session] Synced user to database:", userData.userId);
      } catch (dbError) {
        // Handle unique constraint violation (P2002) - another request may have created
        // the user with a different clerkId but same email. This is recoverable.
        const isUniqueConstraintError =
          dbError instanceof Error &&
          "code" in dbError &&
          (dbError as { code: string }).code === "P2002";

        if (isUniqueConstraintError) {
          console.warn(
            "[Mobile Session] Unique constraint violation during user sync, likely email conflict:",
            userData.userId
          );
          // Continue - the token will still work, Stripe prefilling may just be incomplete
        } else {
          // Log other errors but don't fail - user might already exist
          // The Stripe account creation will still work, just without prefilled data
          console.error("[Mobile Session] Failed to sync user to database:", dbError);
        }
      }
    }

    // Create a short-lived JWT containing the Clerk user ID and profile data
    const token = await createMobileSessionToken(userData.userId, {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
    });

    return NextResponse.json({
      token,
      expiresIn: 15 * 60, // 15 minutes in seconds
    });
  } catch (error) {
    console.error("Error creating mobile session:", error);
    return NextResponse.json(
      {
        error: "Failed to create session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
