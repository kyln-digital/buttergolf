import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { MessagesLayout } from "./MessagesLayout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages | ButterGolf",
  description: "View and manage your conversations with buyers and sellers",
};

export default async function MessagesLayoutPage({ children }: { children: React.ReactNode }) {
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

  // Fetch conversations where the user is buyer or seller
  const rawConversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          price: true,
          isSold: true,
          images: {
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      },
      buyer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          imageUrl: true,
          averageRating: true,
          ratingCount: true,
        },
      },
      seller: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          imageUrl: true,
          averageRating: true,
          ratingCount: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
          type: true,
          offerAmount: true,
          createdAt: true,
        },
      },
      offers: {
        // Pull the latest offer status shown in inbox rows, including accepted offers.
        where: { status: { in: ["PENDING", "COUNTERED", "ACCEPTED"] } },
        select: {
          id: true,
          amount: true,
          status: true,
          counterOffers: {
            select: { amount: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
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

  const conversations = rawConversations.map((conv) => {
    const isBuyer = conv.buyerId === user.id;
    const otherUser = isBuyer ? conv.seller : conv.buyer;
    const otherUserName =
      `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.email;
    const lastMessage = conv.messages[0];
    const latestOffer = conv.offers[0] ?? null;

    let lastMessagePreview: string | null = null;
    if (lastMessage) {
      switch (lastMessage.type) {
        case "OFFER":
          lastMessagePreview = `Offer: £${lastMessage.offerAmount?.toFixed(2)}`;
          break;
        case "COUNTER_OFFER":
          lastMessagePreview = `Counter-offer: £${lastMessage.offerAmount?.toFixed(2)}`;
          break;
        case "OFFER_ACCEPTED":
          lastMessagePreview = "Offer accepted";
          break;
        case "OFFER_REJECTED":
          lastMessagePreview = "Offer declined";
          break;
        case "OFFER_EXPIRED":
          lastMessagePreview = "Offer expired";
          break;
        case "SYSTEM":
          lastMessagePreview = lastMessage.content;
          break;
        default:
          lastMessagePreview = lastMessage.content;
      }
    }

    let latestOfferAmount: number | null = null;
    if (latestOffer) {
      latestOfferAmount = latestOffer.counterOffers[0]?.amount ?? latestOffer.amount;
    }

    return {
      id: conv.id,
      productId: conv.product.id,
      productTitle: conv.product.title,
      productPrice: conv.product.price,
      productImage: conv.product.images[0]?.url || null,
      productSold: conv.product.isSold,
      otherUserId: otherUser.id,
      otherUserName,
      otherUserImage: otherUser.imageUrl,
      otherUserAverageRating: otherUser.averageRating,
      otherUserRatingCount: otherUser.ratingCount,
      lastMessagePreview,
      lastMessageType: lastMessage?.type ?? null,
      lastMessageAt: lastMessage?.createdAt?.toISOString() || conv.updatedAt.toISOString(),
      unreadCount: conv._count.messages,
      userRole: isBuyer ? ("buyer" as const) : ("seller" as const),
      orderId: conv.orderId,
      latestOfferStatus: latestOffer?.status ?? null,
      latestOfferAmount,
    };
  });

  // TrustBar(40px) + ButterHeader(80px) + vertical padding(2×24px) = 168px
  const HEADER_OFFSET_PX = 168;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: `calc(100dvh - ${HEADER_OFFSET_PX}px)`,
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 16px",
        width: "100%",
        boxSizing: "border-box" as const,
      }}
    >
      <MessagesLayout conversations={conversations}>{children}</MessagesLayout>
    </div>
  );
}
