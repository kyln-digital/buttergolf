import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { createRedisSubscriber } from "@/lib/redis";
import type { Redis } from "ioredis";

export const runtime = "nodejs"; // Required for Redis connections
export const maxDuration = 300; // 5 min max (Vercel Pro) — reduces reconnect frequency

/**
 * GET /api/orders/[id]/messages/stream
 * Server-Sent Events (SSE) stream for real-time message updates
 *
 * ★ Insight ─────────────────────────────────────
 * - SSE is Vercel-native, works on serverless (no custom server needed)
 * - Uses Redis Pub/Sub to broadcast across Vercel's distributed functions
 * - Each SSE connection subscribes to order-specific Redis channel
 * - Sends heartbeat every 30s to keep connection alive (prevents proxies from closing)
 * - If Redis is unavailable, runs in heartbeat-only mode (no 500, no reconnect loop)
 *   — messages are still delivered via the client's 10-second polling fallback
 * ─────────────────────────────────────────────────
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate user (works with both cookies and Bearer tokens)
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const { id: orderId } = await params;

    // Verify user is buyer or seller on this order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    });

    if (!order) {
      return new NextResponse("Order not found", { status: 404 });
    }

    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Create SSE stream using Next.js ReadableStream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        let redis: Redis | null = null;
        const channel = `order:${orderId}:messages`;

        // Cleanup helper — called on both disconnect and error
        const cleanup = () => {
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          if (redis) {
            redis.unsubscribe(channel).catch(() => {});
            redis.disconnect();
            redis = null;
          }
        };

        try {
          // Send initial connection event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

          // Attempt to set up Redis pub/sub. If Redis is unavailable (REDIS_URL unset
          // or connection refused), fall through to heartbeat-only mode — the client
          // will still receive new messages via its 10-second polling fallback.
          let subscriber: Redis | null = null;
          try {
            subscriber = createRedisSubscriber();
            await subscriber.subscribe(channel);
            redis = subscriber;
            console.log(`[SSE] User ${user.id} subscribed to channel: ${channel}`);

            // Listen for messages published to this order's channel
            redis.on("message", (receivedChannel: string, message: string) => {
              if (receivedChannel === channel) {
                try {
                  JSON.parse(message); // Verify valid JSON before sending
                  controller.enqueue(encoder.encode(`data: ${message}\n\n`));
                  console.log(`[SSE] Sent message to user ${user.id}`);
                } catch (err) {
                  console.error(`[SSE] Invalid JSON message: ${message}`, err);
                }
              }
            });

            redis.on("error", (err) => {
              console.error(`[SSE] Redis error for user ${user.id}:`, err.message);
              // Don't close the stream on Redis error — heartbeat keeps it alive
              // and the client's polling fallback handles message delivery.
            });
          } catch (redisErr) {
            // Disconnect the failed subscriber to stop reconnect loop
            if (subscriber) {
              subscriber.disconnect();
              subscriber = null;
            }
            console.warn(
              `[SSE] Redis unavailable for user ${user.id}, running heartbeat-only mode`
            );
            // redis stays null — heartbeat-only, no pub/sub
          }

          // Heartbeat every 30 seconds — runs regardless of Redis availability.
          // Prevents proxies/load-balancers from closing idle connections.
          heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`:heartbeat\n\n`));
            } catch {
              // Stream may already be closed — ignore
            }
          }, 30000);

          // Cleanup when client disconnects
          req.signal.addEventListener("abort", () => {
            console.log(`[SSE] User ${user.id} disconnected from channel: ${channel}`);
            cleanup();
            controller.close();
          });
        } catch (err) {
          console.error("[SSE] Error starting stream:", err);
          cleanup();
          controller.error(err);
        }
      },
    });

    // Return SSE response with proper headers
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
      },
    });
  } catch (error) {
    console.error("[SSE] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to establish SSE connection" }, { status: 500 });
  }
}
