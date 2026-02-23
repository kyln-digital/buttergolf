import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { MessageThread } from "./MessageThread";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages | ButterGolf",
  description: "View your conversation",
};

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
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

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
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
      },
      offers: {
        where: { status: { in: ["PENDING", "COUNTERED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, amount: true },
      },
    },
  });

  // If not found, try as a legacy order ID and redirect
  if (!conversation) {
    const convByOrder = await prisma.conversation.findUnique({
      where: { orderId: conversationId },
      select: { id: true },
    });
    if (convByOrder) {
      redirect(`/messages/${convByOrder.id}`);
    }
    redirect("/messages");
  }

  // Authorization: only buyer or seller can view
  if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) {
    redirect("/messages");
  }

  const isBuyer = conversation.buyerId === user.id;
  const otherUser = isBuyer ? conversation.seller : conversation.buyer;
  const otherUserName =
    `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.email;

  return (
    <MessageThread
      conversationId={conversation.id}
      currentUserId={user.id}
      userRole={isBuyer ? "buyer" : "seller"}
      otherUserName={otherUserName}
      otherUserImage={otherUser.imageUrl}
      productTitle={conversation.product.title}
      productImage={conversation.product.images[0]?.url || null}
      productPrice={conversation.product.price}
      productSold={conversation.product.isSold}
      hasActiveOffer={conversation.offers.length > 0}
      initialMessages={conversation.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isRead: m.isRead,
        type: m.type,
        offerAmount: m.offerAmount ?? undefined,
        offerId: m.offerId ?? undefined,
        offerStatus: undefined,
      }))}
    />
  );
}
