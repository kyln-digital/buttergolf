import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { sendNewMessageEmail } from "@/lib/email";
import { getUserIdFromRequest } from "@/lib/auth";
import { getRedisPublisher } from "@/lib/redis";
import { sendMessageNotification } from "@/lib/push-notifications";

/**
 * GET /api/orders/[id]/messages
 * Get all messages for an order
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: orderId } = await params;

    // Get order to verify access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only buyer or seller can view messages
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { orderId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Add role info to messages
    const messagesWithRole = messages.map((msg) => ({
      ...msg,
      senderRole: msg.senderId === order.buyerId ? "buyer" : "seller",
      isOwnMessage: msg.senderId === user.id,
    }));

    return NextResponse.json({
      messages: messagesWithRole,
      userRole: user.id === order.buyerId ? "buyer" : "seller",
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

/**
 * POST /api/orders/[id]/messages
 * Send a message on an order
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting: 10 messages per minute
    const rateLimit = checkRateLimit(user.id, {
      maxRequests: RATE_LIMITS.MESSAGES_PER_MINUTE,
      windowMs: 60000,
      keyFn: (userId) => `messages:${userId}`,
    });

    if (rateLimit.isLimited) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const { id: orderId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    // Get order to verify access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            pushTokens: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            pushTokens: true,
          },
        },
        product: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only buyer or seller can send messages
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        orderId,
        senderId: user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    // Send email notification (async, don't block response)
    const recipient = user.id === order.buyerId ? order.seller : order.buyer;
    const senderName = `${user.firstName} ${user.lastName}`.trim() || "A user";

    try {
      await sendNewMessageEmail({
        recipientEmail: recipient.email,
        recipientName: `${recipient.firstName} ${recipient.lastName}`.trim() || recipient.email,
        senderName,
        orderId: order.id,
        productTitle: order.product.title,
        messagePreview: content.trim(),
      });
    } catch (emailError) {
      console.error("Failed to send message notification email:", emailError);
      // Don't fail the request if email fails
    }

    // Publish message to Redis for real-time SSE delivery (async, non-blocking)
    const redis = getRedisPublisher();
    const channel = `order:${orderId}:messages`;
    const messageEvent = {
      type: "new_message",
      message: {
        id: message.id,
        orderId: message.orderId,
        senderId: message.senderId,
        senderName,
        senderImage: message.sender.imageUrl,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isRead: false,
      },
    };

    redis.publish(channel, JSON.stringify(messageEvent)).catch((err) => {
      console.error(`[Redis] Failed to publish message to ${channel}:`, err);
      // Don't fail the request if Redis publish fails
    });

    // Send push notification to recipient (async, non-blocking)
    // Note: 'recipient' was already defined above for email notification
    const recipientPushTokens = recipient.pushTokens ?? [];
    if (recipientPushTokens.length > 0) {
      sendMessageNotification(
        recipientPushTokens,
        senderName,
        order.product.title,
        content.trim(),
        orderId
      ).catch((err) => {
        console.error("[Push] Failed to send push notification:", err);
        // Don't fail the request if push notification fails
      });
    }

    return NextResponse.json({
      message: {
        ...message,
        senderRole: message.senderId === order.buyerId ? "buyer" : "seller",
        isOwnMessage: true,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
