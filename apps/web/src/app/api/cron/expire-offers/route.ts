import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { broadcastToConversation } from "@/lib/supabase-realtime";
import { toNewMessageBroadcast, toOfferUpdateBroadcast } from "@/lib/conversation-broadcast";
import { sendPushNotifications } from "@/lib/push-notifications";

// Vercel Cron configuration
// Schedule: Run daily at 6:00 AM UTC
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/expire-offers",
//     "schedule": "0 6 * * *"
//   }]
// }

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/expire-offers
 *
 * Marks PENDING and COUNTERED offers as EXPIRED when their expiresAt date has passed.
 * Creates an OFFER_EXPIRED system message in the conversation and notifies both parties.
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured - refusing to process offer expiry");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized cron request - invalid or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("Starting offer expiry cron job...");

  try {
    const expiredOffers = await prisma.offer.findMany({
      where: {
        status: { in: ["PENDING", "COUNTERED"] },
        expiresAt: { lte: new Date() },
      },
      include: {
        product: { select: { title: true } },
        buyer: { select: { id: true, firstName: true, pushTokens: true } },
        seller: { select: { id: true, firstName: true, pushTokens: true } },
        counterOffers: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    console.info(`Found ${expiredOffers.length} expired offer(s) to process`);

    let processed = 0;

    for (const offer of expiredOffers) {
      const currentAmount =
        offer.counterOffers.length > 0 ? offer.counterOffers[0].amount : offer.amount;

      try {
        const [, msg] = await prisma.$transaction([
          prisma.offer.update({
            where: { id: offer.id },
            data: { status: "EXPIRED" },
          }),
          prisma.message.create({
            data: {
              content: "Offer expired",
              senderId: offer.buyerId,
              conversationId: offer.conversationId,
              type: "OFFER_EXPIRED",
              offerAmount: currentAmount,
              offerId: offer.id,
            },
            include: { sender: true },
          }),
          prisma.conversation.update({
            where: { id: offer.conversationId },
            data: { updatedAt: new Date() },
          }),
        ]);

        broadcastToConversation(
          offer.conversationId,
          "new_message",
          toNewMessageBroadcast(msg, { offerStatus: "EXPIRED" })
        ).catch((err) => console.error(`[Broadcast] Error for offer ${offer.id}:`, err));

        broadcastToConversation(
          offer.conversationId,
          "offer_update",
          toOfferUpdateBroadcast({
            offerId: offer.id,
            status: "EXPIRED",
            amount: currentAmount,
          })
        ).catch((err) => console.error(`[Broadcast] Offer update error for ${offer.id}:`, err));

        const pushMessage = `Your offer of £${currentAmount.toFixed(2)} on ${offer.product.title} has expired.`;

        if (offer.buyer.pushTokens.length > 0) {
          sendPushNotifications(offer.buyer.pushTokens, "Offer expired", pushMessage, {
            orderId: offer.conversationId,
          }).catch((err) => console.error(`[Push] Buyer push error for offer ${offer.id}:`, err));
        }

        if (offer.seller.pushTokens.length > 0) {
          sendPushNotifications(offer.seller.pushTokens, "Offer expired", pushMessage, {
            orderId: offer.conversationId,
          }).catch((err) => console.error(`[Push] Seller push error for offer ${offer.id}:`, err));
        }

        processed++;
      } catch (err) {
        console.error(`Failed to expire offer ${offer.id}:`, err);
      }
    }

    console.info(`Offer expiry cron complete. Processed: ${processed}/${expiredOffers.length}`);

    return NextResponse.json({ processed, total: expiredOffers.length });
  } catch (error) {
    console.error("Offer expiry cron job failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
