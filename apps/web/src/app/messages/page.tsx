import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { MessagesInbox } from "./MessagesInbox";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages | ButterGolf",
  description: "View and manage your conversations with buyers and sellers",
};

export default async function MessagesPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch all orders where the user is buyer or seller, with messages
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    },
    include: {
      product: {
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
        },
      },
      seller: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          imageUrl: true,
        },
      },
      buyer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          imageUrl: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1, // Only get latest message for preview
      },
      _count: {
        select: {
          messages: {
            where: {
              isRead: false,
              senderId: { not: user.id },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Transform orders into conversation format
  const conversations = orders.map((order) => {
    const isBuyer = order.buyerId === user.id;
    const otherUser = isBuyer ? order.seller : order.buyer;
    const otherUserName =
      `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.email;
    const lastMessage = order.messages[0];

    return {
      orderId: order.id,
      productTitle: order.product.title,
      productImage: order.product.images[0]?.url || null,
      otherUserName,
      otherUserImage: otherUser.imageUrl,
      lastMessagePreview: lastMessage?.content || null,
      lastMessageAt: lastMessage?.createdAt?.toISOString() || order.createdAt.toISOString(),
      unreadCount: order._count.messages,
      userRole: isBuyer ? ("buyer" as const) : ("seller" as const),
      orderStatus: order.status,
    };
  });

  return <MessagesInbox conversations={conversations} />;
}
