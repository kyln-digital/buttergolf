import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { MessageThread } from "./MessageThread";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return {
    title: "Messages | ButterGolf",
    description: `Conversation for order ${orderId}`,
  };
}

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    redirect("/sign-in");
  }

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) {
    redirect("/messages");
  }

  // Authorization: only buyer or seller can view
  if (order.buyerId !== user.id && order.sellerId !== user.id) {
    redirect("/messages");
  }

  const isBuyer = order.buyerId === user.id;
  const otherUser = isBuyer ? order.seller : order.buyer;
  const otherUserName =
    `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.email;

  return (
    <MessageThread
      orderId={order.id}
      currentUserId={user.id}
      otherUserName={otherUserName}
      otherUserImage={otherUser.imageUrl}
      productTitle={order.product.title}
      productImage={order.product.images[0]?.url || null}
      initialMessages={order.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isRead: m.isRead,
      }))}
    />
  );
}
