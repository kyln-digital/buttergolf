import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/offers/[id]
 * Fetch a single offer with full conversation history
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            images: true,
            user: true, // Seller info
          },
        },
        buyer: true,
        seller: true,
        counterOffers: {
          orderBy: { createdAt: "asc" }, // Chronological order for conversation
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Authorization check: user must be buyer or seller
    if (offer.buyerId !== user.id && offer.sellerId !== user.id) {
      return NextResponse.json({ error: "Unauthorized to view this offer" }, { status: 403 });
    }

    // Check if offer has expired and update status
    if (offer.expiresAt && new Date(offer.expiresAt) < new Date() && offer.status === "PENDING") {
      const updatedOffer = await prisma.offer.update({
        where: { id },
        data: { status: "EXPIRED" },
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
      });
      return NextResponse.json(updatedOffer);
    }

    return NextResponse.json(offer);
  } catch (error) {
    console.error("Error fetching offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/offers/[id]
 * Update offer status (accept/reject)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { status } = await request.json();

    // Validate status
    if (!["ACCEPTED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACCEPTED or REJECTED" },
        { status: 400 }
      );
    }

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: true,
        seller: true,
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Authorization: only seller can accept/reject initial offers
    // Both parties can accept/reject counter-offers
    const isSellerAction = user.id === offer.sellerId;
    const isBuyerAction = user.id === offer.buyerId;

    if (!isSellerAction && !isBuyerAction) {
      return NextResponse.json({ error: "Unauthorized to update this offer" }, { status: 403 });
    }

    // Check if offer is still pending/countered
    if (!["PENDING", "COUNTERED"].includes(offer.status)) {
      return NextResponse.json(
        {
          error: `Cannot ${status.toLowerCase()} offer with status ${offer.status}`,
        },
        { status: 400 }
      );
    }

    // Update offer status
    const updatedOffer = await prisma.offer.update({
      where: { id },
      data: { status },
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
    });

    // TODO: Send email notification
    // if (status === "ACCEPTED") {
    //   await sendOfferAcceptedEmail(updatedOffer);
    // } else if (status === "REJECTED") {
    //   await sendOfferRejectedEmail(updatedOffer);
    // }

    // TODO: Broadcast WebSocket event
    // broadcastOfferUpdate(id, updatedOffer);

    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error("Error updating offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
