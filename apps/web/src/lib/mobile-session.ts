import { SignJWT, jwtVerify, JWTPayload } from "jose";

// Short-lived token secret - should be set in environment
// Falls back to a hash of the Stripe secret key for development
const MOBILE_SESSION_SECRET =
  process.env.MOBILE_SESSION_SECRET ||
  process.env.STRIPE_SECRET_KEY?.slice(0, 32) ||
  "dev-secret-key-minimum-32-chars!";

const secret = new TextEncoder().encode(MOBILE_SESSION_SECRET);

/**
 * Create a mobile session token
 * Used by the mobile-session API route
 */
export async function createMobileSessionToken(userId: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    type: "mobile_onboarding_session",
  } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m") // 15 minute expiry
    .sign(secret);
}

/**
 * Verify a mobile session token
 * Used internally by other API routes to validate mobile WebView requests
 */
export async function verifyMobileSessionToken(token: string): Promise<{ userId: string } | null> {
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
