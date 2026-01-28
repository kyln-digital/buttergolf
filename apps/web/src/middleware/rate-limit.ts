/**
 * Rate Limiting Middleware
 *
 * Provides in-memory rate limiting with sliding window algorithm.
 * Protects API endpoints from abuse and spam.
 *
 * NOTE: In production, consider using Redis/Upstash for distributed rate limiting
 * across multiple server instances.
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

/**
 * Rate limit entry stored in memory
 */
interface RateLimitEntry {
  /** Number of requests made in current window */
  count: number;
  /** When the current window expires */
  resetAt: Date;
}

/**
 * In-memory store for rate limit data
 * Key: user-specific key (e.g., "messages:userId")
 * Value: request count and reset time
 *
 * NOTE: This is cleared on server restart. For production,
 * use Redis/Upstash for persistence.
 */
const store = new Map<string, RateLimitEntry>();

/**
 * Cleanup expired entries periodically
 * Runs every 5 minutes to prevent memory leaks
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (value.resetAt.getTime() < now) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Check if request should be rate limited
 *
 * Uses sliding window algorithm:
 * - Each user gets a fixed number of requests per time window
 * - Window resets after specified time
 * - Returns headers for client to track their usage
 *
 * @param userId - User ID to check rate limit for
 * @param config - Rate limit configuration
 * @returns Rate limit result with isLimited flag and headers
 *
 * @example
 * const rateLimit = checkRateLimit(user.id, {
 *   maxRequests: 10,
 *   windowMs: 60000, // 1 minute
 *   keyFn: (userId) => `messages:${userId}`
 * });
 *
 * if (rateLimit.isLimited) {
 *   return rateLimitResponse(rateLimit.resetAt);
 * }
 */
export function checkRateLimit(userId: string, config: RateLimitConfig): RateLimitResult {
  const key = config.keyFn(userId);
  const now = Date.now();

  let entry = store.get(key);

  // Create new entry or reset if window expired
  if (!entry || entry.resetAt.getTime() < now) {
    entry = {
      count: 0,
      resetAt: new Date(now + config.windowMs),
    };
    store.set(key, entry);
  }

  const isLimited = entry.count >= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  // Increment counter if not limited
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

/**
 * Create HTTP 429 (Too Many Requests) response
 *
 * Includes Retry-After header indicating when to retry
 *
 * @param resetAt - When the rate limit will reset
 * @returns NextResponse with 429 status and appropriate headers
 *
 * @example
 * if (rateLimit.isLimited) {
 *   return rateLimitResponse(rateLimit.resetAt);
 * }
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
