import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/messages/unread-count
 *
 * Returns the total count of unread messages for the current user across all orders.
 * Used for displaying unread badge in header/navigation.
 */
export async function GET(request: Request) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(request);

    if (!clerkId) {
      return NextResponse.json({ count: 0 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    // Count unread messages where the user is NOT the sender
    // (i.e., messages sent TO this user that they haven't read)
    const unreadCount = await prisma.message.count({
      where: {
        isRead: false,
        senderId: { not: user.id },
        order: {
          OR: [{ buyerId: user.id }, { sellerId: user.id }],
        },
      },
    });

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json({ count: 0 });
  }
}
