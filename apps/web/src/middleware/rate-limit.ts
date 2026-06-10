/**
 * Rate Limiting Middleware
 *
 * Uses an in-memory Map for rate limiting within a single serverless instance.
 * Sufficient for per-user throttling — each cold start resets counts, which is
 * an acceptable trade-off vs. adding a distributed store dependency.
 */

import { NextResponse } from "next/server";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Function to generate storage key from user ID */
  keyFn: (userId: string) => string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the rate limit has been exceeded */
  isLimited: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** When the rate limit will reset */
  resetAt: Date;
  /** HTTP headers to include in response */
  headers: Record<string, string>;
}

// ─── In-memory fallback (used when Redis is unavailable) ─────────────

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

const fallbackStore = new Map<string, RateLimitEntry>();

setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of fallbackStore.entries()) {
      if (value.resetAt.getTime() < now) {
        fallbackStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

function checkRateLimitInMemory(userId: string, config: RateLimitConfig): RateLimitResult {
  const key = config.keyFn(userId);
  const now = Date.now();

  let entry = fallbackStore.get(key);

  if (!entry || entry.resetAt.getTime() < now) {
    entry = { count: 0, resetAt: new Date(now + config.windowMs) };
    fallbackStore.set(key, entry);
  }

  const isLimited = entry.count >= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  if (!isLimited) {
    entry.count++;
  }

  return {
    isLimited,
    remaining,
    resetAt: entry.resetAt,
    headers: {
      "X-RateLimit-Limit": config.maxRequests.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": entry.resetAt.toISOString(),
    },
  };
}

// ─── Rate limiting (in-memory) ────────────────────────────────────────

/**
 * Check if request should be rate limited.
 *
 * Uses an in-memory Map for per-instance counting. Each serverless cold
 * start resets counts, which provides a lenient but effective throttle.
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimitInMemory(userId, config);
}

/**
 * Create HTTP 429 (Too Many Requests) response
 */
export function rateLimitResponse(resetAt: Date): NextResponse {
  const retryAfterSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds.toString(),
      },
    }
  );
}

/**
 * Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Convenience wrapper: rate-limit by client IP for a named bucket. Returns a
 * 429 response when the limit is exceeded, otherwise null. Pass the returned
 * `headers` onto your success response if you want to expose the limit.
 */
export async function enforceIpRateLimit(
  request: Request,
  bucket: string,
  options: { maxRequests: number; windowMs: number }
): Promise<NextResponse | null> {
  const clientIp = getClientIp(request);
  const { isLimited, resetAt, headers } = await checkRateLimit(clientIp, {
    maxRequests: options.maxRequests,
    windowMs: options.windowMs,
    keyFn: (ip) => `${bucket}:${ip}`,
  });
  if (isLimited) {
    const response = rateLimitResponse(resetAt);
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
  return null;
}
