import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, amount } = await request.json();

    // Validate input
    if (!productId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid offer data" }, { status: 400 });
    }

    // Get product and check if sold
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { user: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.isSold) {
      return NextResponse.json({ error: "Product is already sold" }, { status: 400 });
    }

    if (product.userId === userId) {
      return NextResponse.json({ error: "Cannot make offer on your own product" }, { status: 400 });
    }

    // Validate offer amount
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

    // Get buyer info
    const buyer = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!buyer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create offer with 7-day expiration
    const offer = await prisma.offer.create({
      data: {
        amount,
        productId,
        buyerId: buyer.id,
        sellerId: product.userId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      include: {
        product: true,
        buyer: true,
        seller: true,
      },
    });

    // TODO: Send email notification to seller
    // await sendOfferNotificationEmail(offer);

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get offers where user is buyer or seller
    const offers = await prisma.offer.findMany({
      where: {
        OR: [{ buyerId: user.id }, { sellerId: user.id }],
      },
      include: {
        product: {
          include: {
            images: true,
          },
        },
        buyer: true,
        seller: true,
        counterOffers: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(offers);
  } catch (error) {
    console.error("Error fetching offers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
