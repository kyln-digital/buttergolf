import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { createMobileSessionToken } from "@/lib/mobile-session";

/**
 * POST /api/stripe/connect/mobile-session
 *
 * Creates a short-lived JWT token for mobile WebView authentication.
 *
 * Security flow:
 * 1. Mobile app calls this endpoint with Clerk Bearer token
 * 2. This endpoint returns a short-lived mobile session token (15 min expiry)
 * 3. Mobile app passes the session token to WebView via URL query param
 * 4. WebView uses the token to authenticate with /api/stripe/connect/account
 * 5. getUserIdFromRequest() verifies the mobile session token via verifyMobileSessionToken()
 *
 * This is more secure than passing Clerk tokens in URLs because:
 * - Short-lived (15 min vs Clerk's longer-lived tokens)
 * - Limited scope (only valid for onboarding flow)
 * - Not stored in browser history/logs with full Clerk privileges
 */
export async function POST(request: Request) {
  try {
    // Authenticate using Clerk Bearer token
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a short-lived JWT containing the Clerk user ID
    const token = await createMobileSessionToken(userId);

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
