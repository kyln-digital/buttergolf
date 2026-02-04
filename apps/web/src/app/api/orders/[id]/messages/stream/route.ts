import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { createRedisSubscriber } from "@/lib/redis";

export const runtime = "nodejs"; // Required for Redis connections

/**
 * GET /api/orders/[id]/messages/stream
 * Server-Sent Events (SSE) stream for real-time message updates
 *
 * ★ Insight ─────────────────────────────────────
 * - SSE is Vercel-native, works on serverless (no custom server needed)
 * - Uses Redis Pub/Sub to broadcast across Vercel's distributed functions
 * - Each SSE connection subscribes to order-specific Redis channel
 * - Sends heartbeat every 30s to keep connection alive (prevents proxies from closing)
 * ─────────────────────────────────────────────────
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate user (works with both cookies and Bearer tokens)
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        // Declare heartbeat interval at outer scope for cleanup
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        try {
          // Create Redis subscriber (new instance for this SSE connection)
          const redis = createRedisSubscriber();
          const channel = `order:${orderId}:messages`;

          // Subscribe to order's message channel
          await redis.subscribe(channel);
          console.log(`[SSE] User ${user.id} subscribed to channel: ${channel}`);

          // Send initial connection event
          const initEvent = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
          controller.enqueue(encoder.encode(initEvent));

          // Heartbeat every 30 seconds to keep connection alive
          // (some proxies/load balancers close idle connections)
          heartbeat = setInterval(() => {
            const event = `:heartbeat\n\n`;
            controller.enqueue(encoder.encode(event));
          }, 30000);

          // Listen for messages published to this order's channel
          redis.on("message", (receivedChannel: string, message: string) => {
            if (receivedChannel === channel) {
              try {
                // Verify it's valid JSON before sending
                JSON.parse(message);
                const event = `data: ${message}\n\n`;
                controller.enqueue(encoder.encode(event));
                console.log(`[SSE] Sent message to user ${user.id}`);
              } catch (err) {
                console.error(`[SSE] Invalid JSON message: ${message}`, err);
              }
            }
          });

          redis.on("error", (err) => {
            console.error(`[SSE] Redis error for user ${user.id}:`, err);
            // Clear heartbeat on error to prevent it continuing
            if (heartbeat) {
              clearInterval(heartbeat);
            }
            controller.error(err);
          });

          // Cleanup when client disconnects
          req.signal.addEventListener("abort", () => {
            console.log(`[SSE] User ${user.id} disconnected from channel: ${channel}`);
            if (heartbeat) {
              clearInterval(heartbeat);
            }
            redis.unsubscribe(channel);
            redis.disconnect();
            controller.close();
          });
        } catch (err) {
          console.error("[SSE] Error starting stream:", err);
          // Clear heartbeat if it was set before error
          if (heartbeat) {
            clearInterval(heartbeat);
          }
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
