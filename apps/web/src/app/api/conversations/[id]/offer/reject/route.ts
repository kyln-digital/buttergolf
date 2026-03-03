import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { broadcastToConversation } from "@/lib/supabase-realtime";
import { sendOfferRejectedEmail } from "@/lib/email";
import { sendPushNotifications } from "@/lib/push-notifications";

/**
 * POST /api/conversations/[id]/offer/reject
 * Reject the active offer (seller or buyer)
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
      return NextResponse.json({ error: "No active offer to reject" }, { status: 404 });
    }

    const isSeller = user.id === offer.sellerId;
    const isBuyer = user.id === offer.buyerId;

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: "Unauthorized to reject this offer" }, { status: 403 });
    }

    // Get the current offer amount for the notification
    const currentAmount =
      offer.counterOffers.length > 0 ? offer.counterOffers[0].amount : offer.amount;

    // Update offer + create system message
    const [updatedOffer, msg] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: offer.id },
        data: { status: "REJECTED" },
      }),
      prisma.message.create({
        data: {
          content: `Offer declined`,
          senderId: user.id,
          conversationId,
          type: "OFFER_REJECTED",
          offerAmount: currentAmount,
          offerId: offer.id,
        },
        include: { sender: true },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Notify the other party
    const otherParty = isSeller ? offer.buyer : offer.seller;

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
      status: "REJECTED",
      amount: currentAmount,
    }).catch((err) => console.error("[Broadcast] Offer update error:", err));

    // Email the other party regardless of who rejected
    sendOfferRejectedEmail({
      buyerEmail: otherParty.email,
      buyerName: isBuyer ? user.firstName || "Buyer" : otherParty.firstName || "Buyer",
      sellerName: isSeller ? user.firstName || "Seller" : otherParty.firstName || "Seller",
      offerAmount: currentAmount,
      productTitle: offer.product.title,
      conversationId,
    }).catch((err) => console.error("[Email] Offer rejected email error:", err));

    if (otherParty.pushTokens.length > 0) {
      sendPushNotifications(
        otherParty.pushTokens,
        "Offer declined",
        `The offer of £${currentAmount.toFixed(2)} on ${offer.product.title} was declined.`,
        { orderId: conversationId }
      ).catch((err) => console.error("[Push] Offer rejected push error:", err));
    }

    return NextResponse.json({
      offer: updatedOffer,
      message: msg,
    });
  } catch (error) {
    console.error("Error rejecting offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
