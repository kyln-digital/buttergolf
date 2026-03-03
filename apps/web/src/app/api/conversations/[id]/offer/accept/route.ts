import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { broadcastToConversation } from "@/lib/supabase-realtime";
import { sendOfferAcceptedEmail } from "@/lib/email";
import { sendPushNotifications } from "@/lib/push-notifications";

/**
 * POST /api/conversations/[id]/offer/accept
 * Accept the active offer (seller or buyer, depending on latest counter-offer direction)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: conversationId } = await params;

    // Fetch the active offer
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
      return NextResponse.json({ error: "No active offer to accept" }, { status: 404 });
    }

    const isSeller = user.id === offer.sellerId;
    const isBuyer = user.id === offer.buyerId;

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: "Unauthorized to accept this offer" }, { status: 403 });
    }

    // Check expiry
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      await prisma.offer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "This offer has expired" }, { status: 400 });
    }

    // Determine who can accept:
    // - PENDING offer: seller accepts (buyer made the offer)
    // - COUNTERED offer: the party who did NOT make the last counter accepts
    if (offer.status === "PENDING" && !isSeller) {
      return NextResponse.json(
        { error: "Only the seller can accept a pending offer" },
        { status: 403 }
      );
    }

    if (offer.status === "COUNTERED" && offer.counterOffers.length > 0) {
      const lastCounter = offer.counterOffers[0];
      if (lastCounter.fromSeller && !isBuyer) {
        return NextResponse.json(
          { error: "Only the buyer can accept a seller's counter-offer" },
          { status: 403 }
        );
      }
      if (!lastCounter.fromSeller && !isSeller) {
        return NextResponse.json(
          { error: "Only the seller can accept a buyer's counter-offer" },
          { status: 403 }
        );
      }
    }

    // Get the accepted amount
    const acceptedAmount =
      offer.counterOffers.length > 0 ? offer.counterOffers[0].amount : offer.amount;

    // Update offer + create system message
    const [updatedOffer, msg] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED" },
      }),
      prisma.message.create({
        data: {
          content: `Offer accepted: £${acceptedAmount.toFixed(2)}`,
          senderId: user.id,
          conversationId,
          type: "OFFER_ACCEPTED",
          offerAmount: acceptedAmount,
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
    // Notify the buyer to complete purchase
    const buyer = offer.buyer;

    broadcastToConversation(conversationId, "new_message", {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      type: msg.type,
      offerAmount: msg.offerAmount,
      offerId: msg.offerId,
      offerStatus: updatedOffer.status,
      createdAt: msg.createdAt,
      isRead: msg.isRead,
    }).catch((err) => console.error("[Broadcast] Error:", err));

    broadcastToConversation(conversationId, "offer_update", {
      offerId: offer.id,
      status: "ACCEPTED",
      amount: acceptedAmount,
    }).catch((err) => console.error("[Broadcast] Offer update error:", err));

    sendOfferAcceptedEmail({
      buyerEmail: buyer.email,
      buyerName: buyer.firstName || "Buyer",
      sellerName: offer.seller.firstName || "Seller",
      acceptedAmount,
      productTitle: offer.product.title,
      conversationId,
      offerId: offer.id,
    }).catch((err) => console.error("[Email] Offer accepted email error:", err));

    if (buyer.pushTokens.length > 0) {
      sendPushNotifications(
        buyer.pushTokens,
        "Offer accepted!",
        `Your offer of £${acceptedAmount.toFixed(2)} on ${offer.product.title} was accepted. Complete your purchase now.`,
        { orderId: conversationId }
      ).catch((err) => console.error("[Push] Offer accepted push error:", err));
    }

    return NextResponse.json({
      offer: updatedOffer,
      message: msg,
      acceptedAmount,
      checkoutUrl: `/checkout?offerId=${offer.id}`,
    });
  } catch (error) {
    console.error("Error accepting offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
