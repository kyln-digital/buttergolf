import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { broadcastToConversation } from "@/lib/supabase-realtime";
import { toNewMessageBroadcast, toOfferUpdateBroadcast } from "@/lib/conversation-broadcast";
import { sendCounterOfferEmail } from "@/lib/email";
import { sendPushNotifications } from "@/lib/push-notifications";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/conversations/[id]/offer/counter
 * Submit a counter-offer (buyer or seller)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isLimited, resetAt, headers } = await checkRateLimit(clerkId, {
      maxRequests: 5,
      windowMs: 60_000,
      keyFn: (id) => `counter:${id}`,
    });
    if (isLimited) return rateLimitResponse(resetAt!);

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: conversationId } = await params;
    const { amount, message: counterMessage } = await request.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid counter-offer amount" }, { status: 400 });
    }

    // Fetch the active offer in this conversation
    const offer = await prisma.offer.findFirst({
      where: {
        conversationId,
        status: { in: ["PENDING", "COUNTERED"] },
      },
      include: {
        product: true,
        buyer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            pushTokens: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            firstName: true,
            pushTokens: true,
          },
        },
        counterOffers: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "No active offer to counter" }, { status: 404 });
    }

    const isSeller = user.id === offer.sellerId;
    const isBuyer = user.id === offer.buyerId;

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: "Unauthorized to counter this offer" }, { status: 403 });
    }

    // Validate amount bounds
    if (amount >= offer.product.price) {
      return NextResponse.json(
        { error: "Counter-offer must be less than listed price" },
        { status: 400 }
      );
    }

    const minimumOffer = offer.product.price * 0.5;
    if (amount < minimumOffer) {
      return NextResponse.json(
        { error: "Counter-offer too low (minimum 50% of listed price)" },
        { status: 400 }
      );
    }

    // Get current negotiation amount
    const currentAmount =
      offer.counterOffers.length > 0 ? offer.counterOffers[0].amount : offer.amount;

    // Seller must counter lower, buyer must counter higher
    if (isSeller && amount >= currentAmount) {
      return NextResponse.json(
        { error: "Seller counter-offer must be lower than current amount" },
        { status: 400 }
      );
    }

    if (isBuyer && amount <= currentAmount) {
      return NextResponse.json(
        { error: "Buyer counter-offer must be higher than current amount" },
        { status: 400 }
      );
    }

    // Create counter-offer, update offer status, create message in a transaction
    const [counterOffer, updatedOffer, msg] = await prisma.$transaction([
      prisma.counterOffer.create({
        data: {
          amount,
          message: counterMessage || null,
          fromSeller: isSeller,
          offerId: offer.id,
        },
      }),
      prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: "COUNTERED",
          expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
        },
      }),
      prisma.message.create({
        data: {
          content: `Counter-offer: £${amount.toFixed(2)}`,
          senderId: user.id,
          conversationId,
          type: "COUNTER_OFFER",
          offerAmount: amount,
          offerId: offer.id,
        },
        include: { sender: true },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Fire-and-forget: broadcast, email, push
    const recipient = isSeller ? offer.buyer : offer.seller;

    broadcastToConversation(
      conversationId,
      "new_message",
      toNewMessageBroadcast(msg, { offerStatus: updatedOffer.status })
    ).catch((err) => console.error("[Broadcast] Error:", err));

    broadcastToConversation(
      conversationId,
      "offer_update",
      toOfferUpdateBroadcast({
        offerId: offer.id,
        status: "COUNTERED",
        amount,
        counterOfferId: counterOffer.id,
      })
    ).catch((err) => console.error("[Broadcast] Offer update error:", err));

    sendCounterOfferEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.firstName || "User",
      counterPartyName: user.firstName || "User",
      counterAmount: amount,
      productTitle: offer.product.title,
      conversationId,
    }).catch((err) => console.error("[Email] Counter-offer email error:", err));

    if (recipient.pushTokens.length > 0) {
      sendPushNotifications(
        recipient.pushTokens,
        `Counter-offer from ${user.firstName || "User"}`,
        `£${amount.toFixed(2)} on ${offer.product.title}`,
        { orderId: conversationId }
      ).catch((err) => console.error("[Push] Counter-offer push error:", err));
    }

    const response = NextResponse.json(
      { counterOffer, offer: updatedOffer, message: msg },
      { status: 201 }
    );
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  } catch (error) {
    console.error("Error creating counter-offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
