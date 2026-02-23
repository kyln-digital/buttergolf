import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/conversations/unread-count
 *
 * Returns total unread message count across all conversations for the
 * current user. Used for badge display in header/navigation.
 */
export async function GET(request: Request) {
  try {
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ count: 0 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const unreadCount = await prisma.message.count({
      where: {
        isRead: false,
        senderId: { not: user.id },
        conversation: {
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
