import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { stripe } from "@/lib/stripe";
import { calculatePricingBreakdownInPence } from "@/lib/pricing";
import { getUserIdFromRequest } from "@/lib/auth";
import { enforceIpRateLimit } from "@/middleware/rate-limit";

// Shipping options with prices in pence
const SHIPPING_OPTIONS = {
  standard: { name: "Royal Mail Tracked 48", price: 499 },
  express: { name: "Royal Mail Tracked 24", price: 699 },
  nextDay: { name: "DPD Next Day", price: 899 },
} as const;

type ShippingOptionId = keyof typeof SHIPPING_OPTIONS;

/**
 * Creates a Stripe Payment Intent for single-product purchase
 *
 * Vinted-style pricing model:
 * - Sellers pay 0% - receive 100% of product price + shipping
 * - Buyers pay: product price + shipping + Buyer Protection Fee (5% + £0.70)
 * - Payment is held on platform until buyer confirms receipt (escrow-style)
 *
 * This is used by PaymentElement flow (BuyNowSheet)
 * For EmbeddedCheckout, see create-checkout-session/route.ts
 */
export async function POST(req: Request) {
  console.info("[PaymentIntent API] POST request received");

  try {
    // Throttle PaymentIntent creation per IP to limit abuse
    const limited = await enforceIpRateLimit(req, "create-payment-intent", {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(req);

    if (!clerkUserId) {
      console.info("[PaymentIntent API] ERROR: No clerkUserId - returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, shippingOptionId } = body as {
      productId: string;
      shippingOptionId: ShippingOptionId;
    };

    console.info(
      "[PaymentIntent API] productId:",
      productId,
      "shippingOptionId:",
      shippingOptionId
    );

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    if (!shippingOptionId || !SHIPPING_OPTIONS[shippingOptionId]) {
      return NextResponse.json({ error: "Valid shipping option is required" }, { status: 400 });
    }

    // Get buyer from Clerk ID
    const buyer = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!buyer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get product with seller information
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        user: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.isSold) {
      return NextResponse.json({ error: "Product is already sold" }, { status: 400 });
    }

    // Prevent buying your own product
    if (product.userId === buyer.id) {
      return NextResponse.json({ error: "Cannot purchase your own product" }, { status: 400 });
    }

    // Get seller info (may not be onboarded yet - Vinted-style flow)
    // Funds stay on platform, transfer happens after delivery confirmed AND seller onboards
    const seller = product.user;
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Calculate Vinted-style pricing (0% seller fee, buyer pays protection fee)
    const productPriceInPence = Math.round(product.price * 100);
    const shippingAmountInPence = SHIPPING_OPTIONS[shippingOptionId].price;
    const pricing = calculatePricingBreakdownInPence(productPriceInPence, shippingAmountInPence);

    // Total includes product + shipping + buyer protection
    const totalAmountInPence =
      productPriceInPence + shippingAmountInPence + pricing.buyerProtectionFeeInPence;

    console.info("[PaymentIntent API] Amounts:", {
      productPriceInPence,
      shippingAmountInPence,
      buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence,
      totalAmountInPence,
      sellerReceivesInPence: pricing.sellerReceivesInPence,
    });

    // Create Payment Intent - payment stays on platform (escrow-style)
    // NO transfer_data - we'll transfer to seller after buyer confirms AND seller is onboarded
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountInPence,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      // NO application_fee_amount - sellers pay 0%
      // NO transfer_data - payment stays on platform until buyer confirms
      metadata: {
        productId: product.id,
        sellerId: seller.id,
        buyerId: buyer.id,
        // Store seller Connect ID for later transfer (omit if seller not yet onboarded)
        ...(seller.stripeConnectId && { sellerStripeConnectId: seller.stripeConnectId }),
        sellerOnboarded: seller.stripeOnboardingComplete ? "true" : "false",
        // Store amounts for order creation
        productPriceInPence: productPriceInPence.toString(),
        shippingAmountInPence: shippingAmountInPence.toString(),
        buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence.toString(),
        sellerPayoutInPence: pricing.sellerReceivesInPence.toString(),
        // Shipping details
        shippingOptionId,
        shippingOptionName: SHIPPING_OPTIONS[shippingOptionId].name,
        source: "payment_element", // Distinguish from checkout session flow
      },
      receipt_email: buyer.email,
    });

    console.info("[PaymentIntent API] SUCCESS - PaymentIntent created:", paymentIntent.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totalAmount: totalAmountInPence,
      shippingAmount: shippingAmountInPence,
      productPriceInPence,
      buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence,
    });
  } catch (error) {
    console.error("[PaymentIntent API] FATAL ERROR:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create payment intent",
      },
      { status: 500 }
    );
  }
}
