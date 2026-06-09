import { SignJWT, jwtVerify, JWTPayload } from "jose";

// Short-lived token signing secret. This authenticates mobile users, so it
// must never fall back to a guessable value — a forged token grants full
// account impersonation across every Bearer-authenticated API route.
function getSecret(): Uint8Array {
  const value = process.env.MOBILE_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "MOBILE_SESSION_SECRET must be set to a random string of at least 32 characters"
    );
  }
  return new TextEncoder().encode(value);
}

/**
 * User data that can be embedded in the mobile session token
 */
export interface MobileSessionUserData {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

/**
 * Create a mobile session token
 * Used by the mobile-session API route
 *
 * @param userId - The Clerk user ID
 * @param userData - Optional user data to embed in the token (firstName, lastName, email)
 */
export async function createMobileSessionToken(
  userId: string,
  userData?: { firstName?: string | null; lastName?: string | null; email?: string | null }
): Promise<string> {
  return new SignJWT({
    sub: userId,
    type: "mobile_onboarding_session",
    // Embed user data for prefilling forms
    firstName: userData?.firstName || null,
    lastName: userData?.lastName || null,
    email: userData?.email || null,
  } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m") // 15 minute expiry
    .sign(getSecret());
}

/**
 * Verify a mobile session token
 * Used internally by other API routes to validate mobile WebView requests
 */
export async function verifyMobileSessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "mobile_onboarding_session" || !payload.sub) {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

/**
 * Get user data from a mobile session token
 * Returns embedded user data (firstName, lastName, email) if present in the token
 */
export async function getMobileSessionUserData(
  token: string
): Promise<MobileSessionUserData | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "mobile_onboarding_session" || !payload.sub) {
      return null;
    }
    // Explicit type validation for JWT payload properties.
    // Non-string values (numbers, objects, undefined, etc.) are treated as null.
    // This protects against malformed or tampered tokens and ensures we only
    // return verified string data that can be safely used for prefilling.
    return {
      userId: payload.sub as string,
      firstName: typeof payload.firstName === "string" ? payload.firstName : null,
      lastName: typeof payload.lastName === "string" ? payload.lastName : null,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    return null;
  }
}
