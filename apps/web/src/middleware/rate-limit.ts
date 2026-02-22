/**
 * Rate Limiting Middleware
 *
 * Uses Redis INCR + EXPIRE for distributed rate limiting across
 * multiple serverless instances. Falls back to in-memory Map when
 * Redis is unavailable.
 */

import { NextResponse } from "next/server";
import { getRedisPublisher } from "@/lib/redis";

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

// ─── Primary: Redis-backed rate limiting ──────────────────────────────

/**
 * Check if request should be rate limited.
 *
 * Uses Redis INCR + EXPIRE for distributed counting across serverless
 * instances. Falls back to in-memory when Redis is unavailable.
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${config.keyFn(userId)}`;
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  try {
    const redis = getRedisPublisher();

    // INCR atomically increments and returns the new count.
    // On first call the key is created with value 1.
    const count = await redis.incr(key);

    // Set expiry only on first increment (count === 1) to avoid
    // resetting the window on subsequent requests.
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    // Read the remaining TTL so the reset time is accurate
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs));

    const isLimited = count > config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);

    return {
      isLimited,
      remaining,
      resetAt,
      headers: {
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": resetAt.toISOString(),
      },
    };
  } catch (err) {
    // Redis unavailable — degrade to in-memory
    console.warn("[RateLimit] Redis unavailable, using in-memory fallback:", err);
    return checkRateLimitInMemory(userId, config);
  }
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
