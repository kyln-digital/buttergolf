import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { broadcastToConversation } from "@/lib/supabase-realtime";
import { sendNewOfferEmail } from "@/lib/email";
import { sendPushNotifications } from "@/lib/push-notifications";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/conversations/[id]/offer
 * Make an offer in a conversation (buyer only)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 offers per minute
    const { isLimited, resetAt, headers } = await checkRateLimit(clerkId, {
      maxRequests: 5,
      windowMs: 60_000,
      keyFn: (id) => `offer:${id}`,
    });
    if (isLimited) return rateLimitResponse(resetAt!);

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: conversationId } = await params;
    const { amount } = await request.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid offer amount" }, { status: 400 });
    }

    // Fetch conversation with product
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        product: true,
        buyer: true,
        seller: {
          select: {
            id: true,
            email: true,
            firstName: true,
            pushTokens: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Only the buyer can make an offer
    if (conversation.buyerId !== user.id) {
      return NextResponse.json({ error: "Only the buyer can make an offer" }, { status: 403 });
    }

    const product = conversation.product;

    if (product.isSold) {
      return NextResponse.json({ error: "Product is already sold" }, { status: 400 });
    }

    // Validate offer amount: >= 50% and < 100% of listed price
    if (amount >= product.price) {
      return NextResponse.json({ error: "Offer must be less than listed price" }, { status: 400 });
    }

    const minimumOffer = product.price * 0.5;
    if (amount < minimumOffer) {
      return NextResponse.json(
        { error: "Offer too low (minimum 50% of listed price)" },
        { status: 400 }
      );
    }

    // Check no existing active offer in this conversation
    const existingOffer = await prisma.offer.findFirst({
      where: {
        conversationId,
        status: { in: ["PENDING", "COUNTERED"] },
      },
    });

    if (existingOffer) {
      return NextResponse.json(
        { error: "An active offer already exists in this conversation" },
        { status: 409 }
      );
    }

    // Create offer + message in a transaction
    const [offer, message] = await prisma.$transaction([
      prisma.offer.create({
        data: {
          amount,
          productId: product.id,
          buyerId: user.id,
          sellerId: conversation.sellerId,
          conversationId,
          status: "PENDING",
          expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
        },
      }),
      prisma.message.create({
        data: {
          content: `Offer: £${amount.toFixed(2)}`,
          senderId: user.id,
          conversationId,
          type: "OFFER",
          offerAmount: amount,
        },
        include: { sender: true },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Link the message to the offer (update after transaction since we need the offer id)
    await prisma.message.update({
      where: { id: message.id },
      data: { offerId: offer.id },
    });

    // Fire-and-forget: broadcast, email, push
    const seller = conversation.seller;

    broadcastToConversation(conversationId, "new_message", {
      ...message,
      offerId: offer.id,
    }).catch((err) => console.error("[Broadcast] Error:", err));

    broadcastToConversation(conversationId, "offer_update", {
      offerId: offer.id,
      status: "PENDING",
      amount,
    }).catch((err) => console.error("[Broadcast] Offer update error:", err));

    sendNewOfferEmail({
      sellerEmail: seller.email,
      sellerName: seller.firstName || "Seller",
      buyerName: user.firstName || "A buyer",
      offerAmount: amount,
      productTitle: product.title,
      productPrice: product.price,
      conversationId,
    }).catch((err) => console.error("[Email] Offer email error:", err));

    if (seller.pushTokens.length > 0) {
      sendPushNotifications(
        seller.pushTokens,
        `New offer from ${user.firstName || "A buyer"}`,
        `£${amount.toFixed(2)} on ${product.title}`,
        { orderId: conversationId } // reusing orderId field for deep link
      ).catch((err) => console.error("[Push] Offer push error:", err));
    }

    const response = NextResponse.json({ offer, message }, { status: 201 });
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
