import { NextRequest, NextResponse } from "next/server";
import { prisma, PromotionType } from "@buttergolf/db";
import { stripe } from "@/lib/stripe";
import { PROMOTION_PRICES, PROMOTION_DURATIONS } from "@/lib/pricing";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/promotions/purchase
 *
 * Purchase a promotion (Bump or Pro Shop Feature) for a product.
 *
 * Vinted-style seller promotions:
 * - Bump (£0.99): 24-hour visibility boost - item appears higher in search/feed
 * - Pro Shop Feature (£4.99): 7-day featured placement in the pro shop section
 *
 * Flow:
 * 1. Seller selects promotion type and product
 * 2. Create PaymentIntent for the promotion price
 * 3. Client completes payment with PaymentElement
 * 4. Webhook creates/activates the promotion
 */
export async function POST(request: NextRequest) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(request);

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, promotionType } = body as {
      productId: string;
      promotionType: "BUMP" | "PRO_SHOP_FEATURE";
    };

    // Validate inputs
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    if (!promotionType || !["BUMP", "PRO_SHOP_FEATURE"].includes(promotionType)) {
      return NextResponse.json(
        { error: "Valid promotion type is required (BUMP or PRO_SHOP_FEATURE)" },
        { status: 400 }
      );
    }

    // Get seller from Clerk ID
    const seller = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!seller) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get product and verify ownership
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.userId !== seller.id) {
      return NextResponse.json(
        { error: "You can only promote your own products" },
        { status: 403 }
      );
    }

    // Check if product is already sold
    if (product.isSold) {
      return NextResponse.json({ error: "Cannot promote a sold product" }, { status: 400 });
    }

    // Check for existing active promotion of the same type
    const existingPromotion = await prisma.productPromotion.findFirst({
      where: {
        productId,
        type: promotionType as PromotionType,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPromotion) {
      return NextResponse.json(
        { error: `Product already has an active ${promotionType} promotion` },
        { status: 400 }
      );
    }

    // Get promotion price
    const priceInPence = PROMOTION_PRICES[promotionType];
    const durationMs = PROMOTION_DURATIONS[promotionType];

    console.log("Creating promotion PaymentIntent:", {
      productId,
      promotionType,
      priceInPence,
      sellerId: seller.id,
    });

    // Create PaymentIntent for the promotion
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInPence,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "promotion",
        productId,
        promotionType,
        sellerId: seller.id,
        durationMs: durationMs.toString(),
        source: "promotion_purchase",
      },
      receipt_email: seller.email,
    });

    // Create pending promotion record
    const promotion = await prisma.productPromotion.create({
      data: {
        productId,
        userId: seller.id,
        type: promotionType as PromotionType,
        status: "PENDING",
        stripePaymentId: paymentIntent.id,
        amountPaid: priceInPence / 100,
      },
    });

    console.log("Promotion PaymentIntent created:", {
      paymentIntentId: paymentIntent.id,
      promotionId: promotion.id,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      promotionId: promotion.id,
      amount: priceInPence,
      promotionType,
      durationHours: durationMs / (60 * 60 * 1000),
    });
  } catch (error) {
    console.error("Error creating promotion PaymentIntent:", error);
    return NextResponse.json({ error: "Failed to create promotion" }, { status: 500 });
  }
}

/**
 * GET /api/promotions/purchase
 *
 * Get promotion pricing information
 */
export async function GET() {
  return NextResponse.json({
    promotions: [
      {
        type: "BUMP",
        name: "Bump",
        description: "24-hour visibility boost - your item appears higher in search and feed",
        price: PROMOTION_PRICES.BUMP / 100,
        priceFormatted: `£${(PROMOTION_PRICES.BUMP / 100).toFixed(2)}`,
        durationHours: PROMOTION_DURATIONS.BUMP / (60 * 60 * 1000),
        durationFormatted: "24 hours",
      },
      {
        type: "PRO_SHOP_FEATURE",
        name: "Pro Shop Feature",
        description: "7-day featured placement - your item showcased in the pro shop section",
        price: PROMOTION_PRICES.PRO_SHOP_FEATURE / 100,
        priceFormatted: `£${(PROMOTION_PRICES.PRO_SHOP_FEATURE / 100).toFixed(2)}`,
        durationHours: PROMOTION_DURATIONS.PRO_SHOP_FEATURE / (60 * 60 * 1000),
        durationFormatted: "7 days",
      },
    ],
  });
}
