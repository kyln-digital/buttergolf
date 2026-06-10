import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// TODO: Remove this entire coming-soon block after launch - set NEXT_PUBLIC_COMING_SOON_ENABLED=false
// and delete ADMIN_USER_IDS, isComingSoonAllowedRoute, and the coming-soon redirect logic below.

// Admin user IDs that bypass the coming-soon redirect.
// Comma-separated Clerk user IDs, e.g. ADMIN_USER_IDS="user_abc,user_def"
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Define protected routes that require authentication
// Note: /api/upload handles its own auth to support mobile Bearer tokens
const isProtectedRoute = createRouteMatcher([
  "/sell(.*)",
  "/seller(.*)", // Seller dashboard with Stripe Connect components
  "/dashboard(.*)",
  "/profile(.*)",
]);

// Routes that should be accessible even when coming soon mode is enabled
const isComingSoonAllowedRoute = createRouteMatcher([
  "/coming-soon",
  "/api/(.*)",
  "/_next/(.*)",
  "/sign-in(.*)", // Allow sign-in for admin bypass
  "/sign-up(.*)", // Allow sign-up for admin bypass
  "/mobile-onboarding(.*)", // Allow mobile Stripe onboarding (uses token-based auth, not cookies)
]);

// Allowlist of browser origins permitted to make cross-origin API calls.
// Native mobile requests carry no Origin header and are unaffected by CORS.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export default clerkMiddleware(
  async (auth, req) => {
    // Handle CORS preflight OPTIONS requests
    if (req.method === "OPTIONS") {
      const origin = req.headers.get("origin");
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      };
      // Only reflect the origin if it is explicitly allowlisted - never echo
      // arbitrary origins or fall back to "*" for Authorization-bearing routes.
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
      }
      return new NextResponse(null, { status: 200, headers });
    }

    // Coming soon mode - redirect all traffic to coming soon page (unless admin)
    const isComingSoonEnabled = process.env.NEXT_PUBLIC_COMING_SOON_ENABLED === "true";

    if (isComingSoonEnabled && !isComingSoonAllowedRoute(req)) {
      // Check if user is the admin (by userId)
      const session = await auth();
      const isAdmin = session?.userId && ADMIN_USER_IDS.includes(session.userId);

      if (!isAdmin) {
        return NextResponse.redirect(new URL("/coming-soon", req.url));
      }
    }

    // Only protect specific routes, leave everything else public
    if (isProtectedRoute(req)) {
      await auth.protect();
    }
  },
  {
    proxyUrl: process.env.NEXT_PUBLIC_CLERK_PROXY_URL || undefined,
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
