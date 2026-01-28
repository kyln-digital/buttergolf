import { Redis } from "ioredis";

let publisherClient: Redis | null = null;

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
      enableOfflineQueue: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis publisher connection failed after 3 retries");
          return null; // Stop retrying after 3 attempts
        }
        // Linear backoff with 3s cap: 100ms, 200ms, 300ms, ... capped at 3000ms
        const delay = Math.min(times * 100, 3000);
        console.warn(`Redis publisher reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    publisherClient.on("error", (err) => {
      console.error("Redis Publisher Error:", err);
    });

    publisherClient.on("connect", () => {
      console.log("Redis publisher connected");
    });

    publisherClient.on("reconnecting", (info) => {
      console.log(`Redis publisher reconnecting: ${JSON.stringify(info)}`);
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
    maxRetriesPerRequest: null, // Never stop retrying for subscribers
    enableReadyCheck: false,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      console.warn(`Redis subscriber reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  subscriber.on("error", (err) => {
    console.error("Redis Subscriber Error:", err);
  });

  subscriber.on("connect", () => {
    console.log("Redis subscriber connected");
  });

  return subscriber;
}
