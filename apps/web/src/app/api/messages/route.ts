import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/messages
 * Get all conversations (inbox) for the current user
 *
 * ★ Insight ─────────────────────────────────────
 * - Aggregates all orders where user is buyer or seller
 * - Includes unread message count per conversation
 * - Returns conversations sorted by most recent message first
 * - Works with both web cookies and mobile Bearer tokens
 * ─────────────────────────────────────────────────
 */
export async function GET(req: Request) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch all orders where user is buyer or seller
    const orders = await prisma.order.findMany({
      where: {
        OR: [{ buyerId: user.id }, { sellerId: user.id }],
      },
      include: {
        product: {
          include: {
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
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            isRead: true,
            senderId: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Transform to conversation format
    interface Conversation {
      orderId: string;
      productTitle: string;
      productImage: string | null;
      otherUserName: string;
      otherUserImage: string | null;
      lastMessagePreview: string | null;
      lastMessageAt: string;
      unreadCount: number;
      userRole: "buyer" | "seller";
      orderStatus: string;
    }

    const conversations: Conversation[] = orders.map((order) => {
      const isBuyer = user.id === order.buyerId;
      const otherUser = isBuyer ? order.seller : order.buyer;
      const lastMessage = order.messages[0];

      // Count unread messages (messages not from current user that are unread)
      const unreadCount = order.messages.filter(
        (msg) => !msg.isRead && msg.senderId !== user.id
      ).length;

      return {
        orderId: order.id,
        productTitle: order.product.title,
        productImage: order.product.images[0]?.url || null,
        otherUserName: `${otherUser.firstName} ${otherUser.lastName}`.trim() || "User",
        otherUserImage: otherUser.imageUrl,
        lastMessagePreview: lastMessage?.content || null,
        lastMessageAt: lastMessage?.createdAt
          ? lastMessage.createdAt.toISOString()
          : order.updatedAt.toISOString(),
        unreadCount,
        userRole: isBuyer ? "buyer" : "seller",
        orderStatus: order.status,
      };
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error fetching messages:", error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
