import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getClerkUserFromRequest } from "@/lib/auth";

async function resolveConversationUser(request: Request) {
  const userData = await getClerkUserFromRequest(request);
  if (!userData) {
    return { user: null, error: "Unauthorized", status: 401 as const };
  }

  let user = await prisma.user.findUnique({
    where: { clerkId: userData.userId },
    select: { id: true },
  });

  if (!userData.email) {
    if (!user) {
      return { user: null, error: "User not found", status: 404 as const };
    }
    return { user, error: null, status: 200 as const };
  }

  if (!user) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: userData.email },
      select: { id: true, clerkId: true },
    });

    if (userByEmail) {
      if (userByEmail.clerkId !== userData.userId) {
        await prisma.user.update({
          where: { id: userByEmail.id },
          data: { clerkId: userData.userId },
        });
      }
      user = { id: userByEmail.id };
    } else {
      user = await prisma.user.create({
        data: {
          clerkId: userData.userId,
          email: userData.email,
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
        },
        select: { id: true },
      });
    }
  }

  return { user, error: null, status: 200 as const };
}

/**
 * GET /api/conversations
 * List conversations (inbox) for the current user, with pagination.
 *
 * Returns each conversation with:
 * - product info (title, image)
 * - other user info (name, avatar)
 * - last message preview
 * - unread count
 * - active offer status (if any)
 *
 * Query params:
 *   page  – page number (default 1)
 *   limit – items per page (default 20, max 50)
 */
export async function GET(req: Request) {
  try {
    const resolvedUser = await resolveConversationUser(req);
    if (!resolvedUser.user) {
      return NextResponse.json({ error: resolvedUser.error }, { status: resolvedUser.status });
    }

    const user = resolvedUser.user;

    const url = new URL(req.url);
    const page = Math.max(parseInt(url.searchParams.get("page") ?? "1", 10), 1);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Math.max(limitParam, 1), 50);
    const skip = (page - 1) * limit;

    const conversations = await prisma.conversation.findMany({
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
            averageRating: true,
            ratingCount: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            averageRating: true,
            ratingCount: true,
          },
        },
        // Latest message for the preview
        messages: {
          select: {
            content: true,
            type: true,
            offerAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        // Latest active offer (PENDING or COUNTERED)
        offers: {
          where: { status: { in: ["PENDING", "COUNTERED"] } },
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
        // Unread count for messages sent by the other party
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
      skip,
      take: limit + 1,
    });

    const hasMore = conversations.length > limit;
    if (hasMore) conversations.pop();

    const result = conversations.map((conv) => {
      const isBuyer = user.id === conv.buyerId;
      const otherUser = isBuyer ? conv.seller : conv.buyer;
      const lastMessage = conv.messages[0];
      const activeOffer = conv.offers[0] ?? null;

      // Derive last message preview text
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

      // Current negotiation amount (latest counter or original offer)
      let activeOfferAmount: number | null = null;
      if (activeOffer) {
        activeOfferAmount = activeOffer.counterOffers[0]?.amount ?? activeOffer.amount;
      }

      return {
        id: conv.id,
        productId: conv.product.id,
        productTitle: conv.product.title,
        productPrice: conv.product.price,
        productImage: conv.product.images[0]?.url ?? null,
        productSold: conv.product.isSold,
        otherUserId: otherUser.id,
        otherUserName: `${otherUser.firstName ?? ""} ${otherUser.lastName ?? ""}`.trim() || "User",
        otherUserImage: otherUser.imageUrl,
        otherUserAverageRating: otherUser.averageRating,
        otherUserRatingCount: otherUser.ratingCount,
        lastMessagePreview,
        lastMessageAt: lastMessage?.createdAt
          ? lastMessage.createdAt.toISOString()
          : conv.updatedAt.toISOString(),
        unreadCount: conv._count.messages,
        userRole: isBuyer ? ("buyer" as const) : ("seller" as const),
        orderId: conv.orderId,
        activeOfferStatus: activeOffer?.status ?? null,
        activeOfferAmount,
      };
    });

    return NextResponse.json({ conversations: result, hasMore, page });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Find-or-create a conversation for a given product.
 *
 * Body: { productId: string }
 *
 * Derives sellerId from the product. Uses the @@unique([productId, buyerId, sellerId])
 * constraint to return an existing conversation if one already exists.
 */
export async function POST(req: Request) {
  try {
    const resolvedUser = await resolveConversationUser(req);
    if (!resolvedUser.user) {
      return NextResponse.json({ error: resolvedUser.error }, { status: resolvedUser.status });
    }

    const user = resolvedUser.user;

    const body = await req.json();
    const { productId } = body;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true, isSold: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.userId === user.id) {
      return NextResponse.json(
        { error: "Cannot start a conversation on your own product" },
        { status: 400 }
      );
    }

    // Upsert: find existing or create new
    const conversation = await prisma.conversation.upsert({
      where: {
        productId_buyerId_sellerId: {
          productId: product.id,
          buyerId: user.id,
          sellerId: product.userId,
        },
      },
      create: {
        productId: product.id,
        buyerId: user.id,
        sellerId: product.userId,
      },
      update: {}, // no-op if exists
      select: { id: true },
    });

    return NextResponse.json({ conversationId: conversation.id }, { status: 200 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
