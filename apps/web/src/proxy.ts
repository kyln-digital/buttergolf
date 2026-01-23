import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// TODO: Remove this entire coming-soon block after launch - set NEXT_PUBLIC_COMING_SOON_ENABLED=false
// and delete ADMIN_USER_IDS, isComingSoonAllowedRoute, and the coming-soon redirect logic below.

// Admin user IDs - bypasses coming-soon redirect
const ADMIN_USER_IDS = [
  "user_37DMusbbHBI1lrqN3spqQGThcyu",
  "user_37pn5LOWh6yBO0JdP61nc1dU1sV",
  "user_37Dahks6xMgGLMf3NSBBDCbLy7A",
  "user_37r3AM2mmrluT7tGdilrqzojvPj",
  "user_37r3CuqmrYiCK8RrfKsp32jpTRD",
  "user_37r3HD53QdkciIGzZ6JyEM6MLci",
  "user_37r3JnUd2cuKXNimgzIp3LAJfnh",
  "user_37r3MdfJ7DSPwUSNjxZhl2XRoD0",
  "user_38ZEyOQHac106JmegFO17Jo8eDx"
];

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
]);

export default clerkMiddleware(async (auth, req) => {
  // DEBUG: Log incoming request headers for API routes to diagnose mobile auth
  if (req.url.includes('/api/')) {
    const authHeader = req.headers.get('Authorization');
    console.log('[Proxy] API request headers:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 30),
      authHeaderLength: authHeader?.length,
      userAgent: req.headers.get('User-Agent')?.substring(0, 80),
      origin: req.headers.get('Origin'),
      host: req.headers.get('Host'),
    });
  }

  // Handle CORS preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    console.log("[Proxy] OPTIONS preflight request:", {
      origin,
      url: req.url,
      requestedHeaders: req.headers.get("Access-Control-Request-Headers"),
    });
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Coming soon mode - redirect all traffic to coming soon page (unless admin)
  const isComingSoonEnabled =
    process.env.NEXT_PUBLIC_COMING_SOON_ENABLED === "true";

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
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
