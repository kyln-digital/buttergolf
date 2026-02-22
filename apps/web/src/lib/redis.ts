import { Redis } from "ioredis";

let publisherClient: Redis | null = null;
let cacheClient: Redis | null = null;

// ============================================================================
// CACHING UTILITIES
// ============================================================================

/**
 * Get or create a singleton Redis cache client.
 * Separate from pub/sub clients to avoid blocking operations.
 *
 * ★ Insight ─────────────────────────────────────
 * - Uses singleton pattern for connection reuse
 * - Graceful degradation when Redis is unavailable
 * - Separate from pub/sub to avoid subscription mode conflicts
 * ─────────────────────────────────────────────────
 */
function getCacheClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null; // Gracefully degrade if Redis not configured
  }

  if (!cacheClient) {
    cacheClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis cache connection failed after 3 retries");
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    cacheClient.on("error", (err) => {
      console.error("Redis Cache Error:", err);
    });

    cacheClient.on("connect", () => {
      console.log("Redis cache connected");
    });
  }

  return cacheClient;
}

/**
 * Get a cached value by key.
 * Returns null if key doesn't exist or Redis is unavailable.
 *
 * @param key - Cache key
 * @returns Parsed JSON value or null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getCacheClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`Cache get error for key "${key}":`, error);
    return null;
  }
}

/**
 * Set a cached value with TTL.
 * Fails silently if Redis is unavailable.
 *
 * @param key - Cache key
 * @param value - Value to cache (will be JSON stringified)
 * @param ttlSeconds - Time to live in seconds
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getCacheClient();
  if (!client) return;

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.warn(`Cache set error for key "${key}":`, error);
  }
}

/**
 * Get cached value or compute and cache it (cache-aside pattern).
 * If Redis is unavailable, always calls fetchFn.
 *
 * @param key - Cache key
 * @param ttlSeconds - Time to live in seconds
 * @param fetchFn - Function to compute value if not cached
 * @returns Cached or freshly computed value
 *
 * ★ Usage Example ─────────────────────────────────
 * const rates = await cacheGetOrSet(
 *   `shipping:${fromZip}:${toZip}`,
 *   900, // 15 minutes
 *   async () => calculateRatesFromAPI()
 * );
 * ─────────────────────────────────────────────────
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Compute fresh value
  const value = await fetchFn();

  // Cache it (fire-and-forget, don't await)
  cacheSet(key, value, ttlSeconds).catch(() => {
    // Ignore cache errors, value was already computed
  });

  return value;
}

/**
 * Delete a cached value.
 * Useful for cache invalidation.
 *
 * @param key - Cache key to delete
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getCacheClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.warn(`Cache delete error for key "${key}":`, error);
  }
}

/**
 * Delete all keys matching a pattern.
 * Useful for bulk cache invalidation (e.g., all rates for a product).
 *
 * Uses SCAN with cursor-based iteration to avoid blocking Redis
 * on large keyspaces (unlike KEYS which blocks during scan).
 *
 * @param pattern - Redis pattern (e.g., "shipping:rates:*:productId")
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getCacheClient();
  if (!client) return;

  try {
    let cursor = "0";

    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);

      if (keys.length > 0) {
        await client.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== "0");
  } catch (error) {
    console.warn(`Cache delete pattern error for "${pattern}":`, error);
  }
}

// ============================================================================
// PUB/SUB UTILITIES
// ============================================================================

/**
 * Get or create a singleton Redis publisher client.
 * This is used for publishing messages to channels.
 *
 * ★ Insight ─────────────────────────────────────
 * - Uses singleton pattern to reuse single connection across all requests
 * - Publisher doesn't need retries configured (fire-and-forget on publish)
 * - Exponential backoff prevents overwhelming Redis on connection issues
 * ─────────────────────────────────────────────────
 */
export function getRedisPublisher(): Redis {
  if (!publisherClient) {
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    publisherClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis publisher connection failed after 3 retries");
          return null; // Stop retrying after 3 attempts
        }
        const delay = Math.min(times * 200, 3000);
        if (times === 1) {
          console.warn(`Redis publisher reconnecting in ${delay}ms (attempt ${times})`);
        }
        return delay;
      },
    });

    let publisherErrorLogged = false;
    publisherClient.on("error", (err) => {
      if (!publisherErrorLogged) {
        console.error("Redis Publisher Error:", err.message);
        publisherErrorLogged = true;
      }
    });

    publisherClient.on("connect", () => {
      publisherErrorLogged = false;
      console.log("Redis publisher connected");
    });
  }

  return publisherClient;
}

/**
 * Create a new Redis subscriber client.
 * Each subscriber needs its own instance to avoid shared state issues.
 *
 * ★ Insight ─────────────────────────────────────
 * - Never reuse subscriber clients (each SSE connection gets new instance)
 * - maxRetriesPerRequest: null means never stop retrying for subscribers
 * - Subscribers must stay connected longer than publishers
 * ─────────────────────────────────────────────────
 */
export function createRedisSubscriber(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  const subscriber = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 5) {
        console.error(`Redis subscriber giving up after ${times} attempts`);
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 3000);
      if (times === 1) {
        console.warn(`Redis subscriber reconnecting in ${delay}ms (attempt ${times})`);
      }
      return delay;
    },
  });

  let errorLogged = false;
  subscriber.on("error", (err) => {
    if (!errorLogged) {
      console.error("Redis Subscriber Error:", err.message);
      errorLogged = true;
    }
  });

  subscriber.on("connect", () => {
    errorLogged = false;
    console.log("Redis subscriber connected");
  });

  return subscriber;
}
