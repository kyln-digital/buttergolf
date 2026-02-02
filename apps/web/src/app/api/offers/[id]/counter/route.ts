import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/offers/[id]/counter
 * Submit a counter-offer
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const { amount, message } = await request.json();

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid counter-offer amount" }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: true,
        seller: true,
        counterOffers: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get most recent counter-offer
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Authorization: user must be buyer or seller
    const isSeller = user.id === offer.sellerId;
    const isBuyer = user.id === offer.buyerId;

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: "Unauthorized to counter this offer" }, { status: 403 });
    }

    // Check if offer is still active
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return NextResponse.json(
        { error: `Cannot counter offer with status ${offer.status}` },
        { status: 400 }
      );
    }

    // Validate counter-offer amount
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

    // Get the current offer amount (either original or last counter-offer)
    const currentAmount =
      offer.counterOffers.length > 0 ? offer.counterOffers[0].amount : offer.amount;

    // Validate counter-offer logic:
    // - Seller must counter lower than current amount
    // - Buyer must counter higher than current amount
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

    // Create counter-offer and update offer status in a transaction
    const [counterOffer, updatedOffer] = await prisma.$transaction([
      prisma.counterOffer.create({
        data: {
          amount,
          message,
          fromSeller: isSeller,
          offerId: id,
        },
      }),
      prisma.offer.update({
        where: { id },
        data: {
          status: "COUNTERED",
          // Extend expiration by 7 days on each counter-offer
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        include: {
          product: {
            include: {
              images: true,
              user: true,
            },
          },
          buyer: true,
          seller: true,
          counterOffers: {
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);

    // TODO: Send email notification to the other party
    // const recipient = isSeller ? offer.buyer : offer.seller;
    // await sendCounterOfferEmail(recipient, updatedOffer, counterOffer);

    // TODO: Broadcast WebSocket event
    // broadcastOfferUpdate(id, updatedOffer);

    return NextResponse.json(updatedOffer, { status: 201 });
  } catch (error) {
    console.error("Error creating counter-offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
