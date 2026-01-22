import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { SignJWT, jwtVerify, JWTPayload } from "jose";

// Short-lived token secret - should be set in environment
// Falls back to a hash of the Stripe secret key for development
const MOBILE_SESSION_SECRET =
  process.env.MOBILE_SESSION_SECRET ||
  process.env.STRIPE_SECRET_KEY?.slice(0, 32) ||
  "dev-secret-key-minimum-32-chars!";

const secret = new TextEncoder().encode(MOBILE_SESSION_SECRET);

/**
 * POST /api/stripe/connect/mobile-session
 *
 * Creates a short-lived JWT token for mobile WebView authentication.
 *
 * This allows the mobile app to:
 * 1. Get a token from this endpoint (using Clerk Bearer auth)
 * 2. Pass the token to the WebView via URL query param
 * 3. WebView uses the token to authenticate with /api/stripe/connect/account
 *
 * Token is valid for 15 minutes - enough time to complete onboarding.
 */
export async function POST(request: Request) {
  try {
    // Authenticate using Clerk Bearer token
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a short-lived JWT containing the Clerk user ID
    // The /api/stripe/connect/account endpoint already supports Bearer tokens
    // So we'll create a token that mimics the Clerk JWT format
    const token = await new SignJWT({
      sub: userId,
      type: "mobile_onboarding_session",
    } as JWTPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m") // 15 minute expiry
      .sign(secret);

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

/**
 * Verify a mobile session token
 * Used internally by other API routes to validate mobile WebView requests
 */
export async function verifyMobileSessionToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "mobile_onboarding_session" || !payload.sub) {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
