import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { RATE_LIMITS, MESSAGE_LIMITS } from "@/lib/constants";
import { sendNewMessageEmail } from "@/lib/email";
import { getUserIdFromRequest } from "@/lib/auth";
import { broadcastToConversation } from "@/lib/supabase-realtime";
import { toNewMessageBroadcast } from "@/lib/conversation-broadcast";
import { sendMessageNotification } from "@/lib/push-notifications";

/**
 * GET /api/conversations/[id]/messages
 * Cursor-paginated messages for a conversation.
 *
 * Query params:
 *   cursor – message ID to paginate from (fetch older messages before this)
 *   limit  – number of messages (default 50, max 100)
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await getUserIdFromRequest(req);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        productId: true,
        orderId: true,
        product: {
          select: {
            title: true,
            price: true,
            isSold: true,
            images: {
              select: { url: true },
              take: 1,
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Only participants can view
    if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limitParam = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        offer: {
          select: {
            status: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const nextCursor = hasMore ? (messages[messages.length - 1]?.id ?? null) : null;

    // Reverse to chronological (oldest first)
    messages.reverse();

    const messagesWithRole = messages.map((msg) => {
      const { offer, ...rest } = msg;
      return {
        ...rest,
        offerStatus: offer?.status ?? null,
        senderRole: msg.senderId === conversation.buyerId ? "buyer" : "seller",
        isOwnMessage: msg.senderId === user.id,
      };
    });

    // Return conversation metadata alongside messages
    const isBuyer = user.id === conversation.buyerId;
    const otherUser = isBuyer ? conversation.seller : conversation.buyer;

    return NextResponse.json({
      messages: messagesWithRole,
      conversation: {
        id: conversation.id,
        productId: conversation.productId,
        productTitle: conversation.product.title,
        productPrice: conversation.product.price,
        productImage: conversation.product.images[0]?.url ?? null,
        productSold: conversation.product.isSold,
        orderId: conversation.orderId,
        otherUserId: otherUser.id,
        otherUserName: `${otherUser.firstName ?? ""} ${otherUser.lastName ?? ""}`.trim() || "User",
        otherUserImage: otherUser.imageUrl,
        userRole: isBuyer ? "buyer" : "seller",
      },
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Send a text message in a conversation.
 *
 * Body: { content: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // Rate limit: 10 messages per minute
    const rateLimit = await checkRateLimit(user.id, {
      maxRequests: RATE_LIMITS.MESSAGES_PER_MINUTE,
      windowMs: 60_000,
      keyFn: (userId) => `messages:${userId}`,
    });
    if (rateLimit.isLimited) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const { id: conversationId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    if (content.length > MESSAGE_LIMITS.MAX_LENGTH) {
      return NextResponse.json(
        { error: `Message too long (max ${MESSAGE_LIMITS.MAX_LENGTH} characters)` },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
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
          select: { title: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: content.trim(),
        type: "TEXT",
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

    // Touch conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const senderName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "A user";
    const recipient = user.id === conversation.buyerId ? conversation.seller : conversation.buyer;

    // Email notification (async, don't block response)
    sendNewMessageEmail({
      recipientEmail: recipient.email,
      recipientName:
        `${recipient.firstName ?? ""} ${recipient.lastName ?? ""}`.trim() || recipient.email,
      senderName,
      orderId: conversation.orderId ?? conversation.id,
      productTitle: conversation.product.title,
      messagePreview: content.trim(),
    }).catch((err) => {
      console.error("Failed to send message notification email:", err);
    });

    // Broadcast via Supabase Realtime (async, non-blocking)
    broadcastToConversation(
      conversationId,
      "new_message",
      toNewMessageBroadcast(
        {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
          isRead: false,
        },
        {}
      )
    ).catch((err) => {
      console.error(
        `[Supabase] Failed to broadcast message for conversation ${conversationId}:`,
        err
      );
    });

    // Push notification (async, non-blocking)
    const recipientPushTokens = recipient.pushTokens ?? [];
    if (recipientPushTokens.length > 0) {
      sendMessageNotification(
        recipientPushTokens,
        senderName,
        conversation.product.title,
        content.trim(),
        conversation.orderId ?? conversationId
      ).catch((err) => {
        console.error("[Push] Failed to send push notification:", err);
      });
    }

    return NextResponse.json({
      message: {
        ...message,
        senderRole: message.senderId === conversation.buyerId ? "buyer" : "seller",
        isOwnMessage: true,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
