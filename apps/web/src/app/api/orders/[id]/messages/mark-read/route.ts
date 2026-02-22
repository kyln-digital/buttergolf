import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { broadcastToOrder } from "@/lib/supabase-realtime";

/**
 * POST /api/orders/[id]/messages/mark-read
 * Mark messages as read for the current user
 *
 * This endpoint should be called when messages are actually visible to the user
 * (e.g., using Intersection Observer in the frontend) rather than automatically
 * on GET to provide a more accurate read status.
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

    const { id: orderId } = await params;

    // Verify order access (buyer or seller)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        buyerId: true,
        sellerId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark unread messages from other party as read
    const result = await prisma.message.updateMany({
      where: {
        orderId,
        senderId: { not: user.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    // Broadcast read receipt via Supabase Realtime so the other party's
    // UI updates message bubbles to "read" in real time.
    if (result.count > 0) {
      broadcastToOrder(orderId, "messages_read", {
        type: "messages_read",
        readerId: user.id,
      }).catch((err) => {
        console.warn(`[Supabase] Read receipt broadcast failed for order ${orderId}:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      markedAsRead: result.count,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }
}
