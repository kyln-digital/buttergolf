import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { SHIPPING_OPTIONS } from "@buttergolf/constants";
import { stripe } from "@/lib/stripe";
import { calculatePricingBreakdownInPence } from "@/lib/pricing";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * Creates a Stripe Embedded Checkout Session for single-product purchase
 *
 * Vinted-style pricing model:
 * - Sellers pay 0% - receive 100% of product price + shipping
 * - Buyers pay: product price + shipping + Buyer Protection Fee (5% + £0.70)
 * - Payment is held on platform until buyer confirms receipt (escrow-style)
 */
export async function POST(req: Request) {
  console.info("[Checkout API] POST request received");

  try {
    console.info("[Checkout API] Checking auth...");
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(req);
    console.info("[Checkout API] Clerk userId:", clerkUserId ? "present" : "missing");

    if (!clerkUserId) {
      console.info("[Checkout API] ERROR: No clerkUserId - returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, offerId } = body;
    console.info("[Checkout API] productId:", productId, "offerId:", offerId || "none");

    if (!productId) {
      console.info("[Checkout API] ERROR: No productId - returning 400");
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Get buyer from Clerk ID
    console.info("[Checkout API] Looking up buyer with clerkId:", clerkUserId);
    const buyer = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });
    console.info("[Checkout API] Buyer found:", buyer ? buyer.id : "NOT FOUND");

    if (!buyer) {
      console.info("[Checkout API] ERROR: Buyer not found - returning 404");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Public purchase path — same visibility as PaymentIntent / listings:
    // no drafts, no deleted sellers (leaked id must not open checkout).
    console.info("[Checkout API] Looking up product:", productId);
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isDraft: false,
        user: { is: { isDeleted: false } },
      },
      include: {
        user: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    });
    console.info("[Checkout API] Product found:", product ? product.title : "NOT FOUND");

    if (!product) {
      console.info("[Checkout API] ERROR: Product not found - returning 404");
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.info("[Checkout API] Product isSold:", product.isSold);
    if (product.isSold) {
      console.info("[Checkout API] ERROR: Product already sold - returning 400");
      return NextResponse.json({ error: "Product is already sold" }, { status: 400 });
    }

    // Prevent buying your own product
    console.info(
      "[Checkout API] Checking ownership - product.userId:",
      product.userId,
      "buyer.id:",
      buyer.id
    );
    if (product.userId === buyer.id) {
      console.info("[Checkout API] ERROR: User trying to buy own product - returning 400");
      return NextResponse.json({ error: "Cannot purchase your own product" }, { status: 400 });
    }

    // If offerId provided, validate the accepted offer and use its price
    let effectivePrice = product.price;
    let validatedOfferId: string | undefined;

    if (offerId) {
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          counterOffers: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!offer) {
        return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      }

      if (offer.status !== "ACCEPTED") {
        return NextResponse.json(
          { error: "Offer must be accepted before checkout" },
          { status: 400 }
        );
      }

      if (offer.buyerId !== buyer.id) {
        return NextResponse.json({ error: "This offer does not belong to you" }, { status: 403 });
      }

      if (offer.productId !== productId) {
        return NextResponse.json({ error: "Offer does not match product" }, { status: 400 });
      }

      // Use the accepted amount (latest counter-offer or original)
      effectivePrice =
        offer.counterOffers.length > 0 ? offer.counterOffers[0].amount : offer.amount;
      validatedOfferId = offer.id;
      console.info("[Checkout API] Using accepted offer price:", effectivePrice);
    }

    // Get seller's Stripe Connect account (may be null if not yet onboarded)
    // In Vinted-style flow, we allow purchases even if seller hasn't onboarded yet
    // Funds stay on platform, and transfer happens after BOTH delivery confirmed AND seller onboards
    const seller = product.user;
    console.info(
      "[Checkout API] Seller stripeConnectId:",
      seller.stripeConnectId ? "present" : "NOT_YET_ONBOARDED"
    );
    console.info(
      "[Checkout API] Seller stripeOnboardingComplete:",
      seller.stripeOnboardingComplete
    );

    // Calculate Vinted-style pricing (0% seller fee, buyer pays protection fee)
    const productPriceInPence = Math.round(effectivePrice * 100);
    // Note: We don't know shipping cost yet - Stripe will add it based on buyer selection
    // We calculate buyer protection fee based on product price only
    const pricing = calculatePricingBreakdownInPence(productPriceInPence, 0);

    // Build product image URL for Stripe (use first image or placeholder)
    const productImages = product.images[0]?.url ? [product.images[0].url] : undefined;

    // Get base URL for return URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "http://localhost:3000";

    // Create Stripe Embedded Checkout Session
    // NOTE: branding_settings is NOT allowed when ui_mode is "embedded"
    // Branding for embedded checkout must be configured in Stripe Dashboard:
    // Settings > Branding > Checkout appearance
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",

      // Line items - product + buyer protection fee
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: product.title,
              description: product.description.slice(0, 500), // Stripe limits description length
              images: productImages,
              metadata: {
                productId: product.id,
              },
            },
            unit_amount: productPriceInPence,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Buyer Protection",
              description:
                "Secure payment held until you confirm receipt. Includes purchase protection and support.",
            },
            unit_amount: pricing.buyerProtectionFeeInPence,
          },
          quantity: 1,
        },
      ],

      // Shipping address collection (UK only for v1)
      shipping_address_collection: {
        allowed_countries: ["GB"],
      },

      // Shipping options - flat rates from @buttergolf/constants (shared with
      // PaymentElement flow and mobile display)
      shipping_options: SHIPPING_OPTIONS.map((option) => ({
        shipping_rate_data: {
          type: "fixed_amount" as const,
          fixed_amount: {
            amount: option.priceInPence,
            currency: "gbp",
          },
          display_name: option.name,
          delivery_estimate: {
            minimum: {
              unit: "business_day" as const,
              value: option.deliveryEstimate.minBusinessDays,
            },
            maximum: {
              unit: "business_day" as const,
              value: option.deliveryEstimate.maxBusinessDays,
            },
          },
        },
      })),

      // Phone number collection for shipping
      phone_number_collection: {
        enabled: true,
      },

      // Payment stays on platform account (escrow-style)
      // NO transfer_data - we'll transfer to seller after buyer confirms receipt AND seller is onboarded
      payment_intent_data: {
        metadata: {
          productId: product.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          // Store seller Connect ID for later transfer (may be null if seller not yet onboarded)
          sellerStripeConnectId: seller.stripeConnectId || "",
          sellerOnboarded: seller.stripeOnboardingComplete ? "true" : "false",
          // Store calculated amounts for order creation
          productPriceInPence: productPriceInPence.toString(),
          buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence.toString(),
          // Offer-based checkout
          offerId: validatedOfferId || "",
        },
      },

      // Session metadata for webhook processing
      metadata: {
        productId: product.id,
        sellerId: seller.id,
        buyerId: buyer.id,
        sellerStripeConnectId: seller.stripeConnectId || "",
        sellerOnboarded: seller.stripeOnboardingComplete ? "true" : "false",
        productPriceInPence: productPriceInPence.toString(),
        buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence.toString(),
        offerId: validatedOfferId || "",
      },

      // Return URL after checkout completes
      return_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

      // Customer email for receipt
      customer_email: buyer.email,
    });

    console.info("[Checkout API] SUCCESS - Session created:", session.id);
    console.info("[Checkout API] clientSecret present:", !!session.client_secret);

    return NextResponse.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    console.error("[Checkout API] FATAL ERROR:", error);
    console.error(
      "[Checkout API] Error type:",
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error(
      "[Checkout API] Error message:",
      error instanceof Error ? error.message : String(error)
    );

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create checkout",
      },
      { status: 500 }
    );
  }
}
