import { auth } from "@clerk/nextjs/server";
import { verifyMobileSessionToken } from "@/app/api/stripe/connect/mobile-session/route";

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
export async function getUserIdFromRequest(
  request?: Request,
): Promise<string | null> {
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
        console.log("[Auth] Authenticated via mobile session token:", { userId: mobileSession.userId });
        return mobileSession.userId;
      }
    }
  }

  console.log("[Auth] Not authenticated via any method");
  return null;
}
