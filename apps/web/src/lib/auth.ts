import { auth, currentUser } from "@clerk/nextjs/server";
import { verifyMobileSessionToken, getMobileSessionUserData } from "@/lib/mobile-session";
import { createClerkClient } from "@clerk/backend";

// Clerk backend client for fetching user data by ID
// Lazily initialised to avoid build-time failures when env vars are unavailable
let clerkBackend: ReturnType<typeof createClerkClient> | null = null;

function getClerkBackend() {
  if (!clerkBackend) {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY is required for Clerk backend client");
    }

    clerkBackend = createClerkClient({
      secretKey: clerkSecretKey,
    });
  }

  return clerkBackend;
}

/**
 * User profile data returned from Clerk
 */
export interface ClerkUserData {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

/**
 * Get user ID using Clerk's Next.js SDK auth() helper, with fallback to mobile session tokens.
 *
 * This supports authentication from:
 * 1. Clerk cookies (__session) - for same-origin web requests
 * 2. Clerk Bearer tokens - for standard API requests (via auth({ acceptsToken: 'session_token' }))
 * 3. Mobile session tokens - short-lived JWT tokens for WebView requests
 *
 * The mobile session token flow is used by the mobile app WebView:
 * - Mobile app gets a short-lived token from /api/stripe/connect/mobile-session
 * - WebView passes this token to API routes
 * - This is more secure than passing long-lived Clerk tokens in URLs
 *
 * @param request - Optional Request object (used for mobile session token extraction)
 * @returns The Clerk user ID (userId), or null if user is not authenticated
 */
export async function getUserIdFromRequest(request?: Request): Promise<string | null> {
  // First, try Clerk's official auth() helper with acceptsToken parameter
  // This handles both cookies (web) and Clerk Bearer tokens (mobile)
  const { isAuthenticated, userId } = await auth({
    acceptsToken: "session_token",
  });

  if (isAuthenticated && userId) {
    console.log("[Auth] Authenticated via Clerk:", { userId });
    return userId;
  }

  // If Clerk auth failed, try mobile session token from Authorization header
  // This handles the WebView case where we use short-lived mobile session tokens
  if (request) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const mobileSession = await verifyMobileSessionToken(token);
      if (mobileSession) {
        console.log("[Auth] Authenticated via mobile session token:", {
          userId: mobileSession.userId,
        });
        return mobileSession.userId;
      }
    }
  }

  console.log("[Auth] Not authenticated via any method");
  return null;
}

/**
 * Get Clerk user profile data from the request.
 *
 * This supports authentication from:
 * 1. Clerk cookies (__session) - uses currentUser() for same-origin web requests
 * 2. Mobile session tokens - uses Clerk backend API to fetch user by ID
 *
 * @param request - Optional Request object (used for mobile session token extraction)
 * @returns User profile data (userId, firstName, lastName, email), or null if not authenticated
 */
export async function getClerkUserFromRequest(request?: Request): Promise<ClerkUserData | null> {
  // First, try Clerk's official auth() helper
  const { isAuthenticated, userId } = await auth({
    acceptsToken: "session_token",
  });

  if (isAuthenticated && userId) {
    // For web requests, use currentUser() to get full profile
    const user = await currentUser();
    if (user) {
      console.log("[Auth] Got Clerk user data:", {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses[0]?.emailAddress,
      });
      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses[0]?.emailAddress || null,
      };
    } else {
      // Authenticated via Clerk but failed to load full user profile.
      // Return partial data with just the userId instead of falling back to mobile tokens.
      console.warn(
        "[Auth] Clerk auth succeeded (isAuthenticated && userId) but currentUser() returned null; returning partial user data."
      );
      return {
        userId,
        firstName: null,
        lastName: null,
        email: null,
      };
    }
  }

  // If Clerk auth failed, try mobile session token from Authorization header
  if (request) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      // First try getting user data embedded in the mobile session token
      const mobileUserData = await getMobileSessionUserData(token);
      if (mobileUserData) {
        console.log("[Auth] Got user data from mobile session token:", mobileUserData);
        return mobileUserData;
      }

      // Fall back to verifying token and fetching from Clerk backend
      const mobileSession = await verifyMobileSessionToken(token);
      if (mobileSession) {
        try {
          const user = await getClerkBackend().users.getUser(mobileSession.userId);
          console.log("[Auth] Got Clerk user data via backend API:", {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.emailAddresses[0]?.emailAddress,
          });
          return {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.emailAddresses[0]?.emailAddress || null,
          };
        } catch (error) {
          console.error("[Auth] Failed to fetch user from Clerk backend:", error);
          // Return partial data with just userId
          return {
            userId: mobileSession.userId,
            firstName: null,
            lastName: null,
            email: null,
          };
        }
      }
    }
  }

  console.log("[Auth] Not authenticated via any method");
  return null;
}
