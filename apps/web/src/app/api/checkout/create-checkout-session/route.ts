import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
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
  console.log("[Checkout API] POST request received");

  try {
    console.log("[Checkout API] Checking auth...");
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(req);
    console.log("[Checkout API] Clerk userId:", clerkUserId ? "present" : "missing");

    if (!clerkUserId) {
      console.log("[Checkout API] ERROR: No clerkUserId - returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;
    console.log("[Checkout API] productId:", productId);

    if (!productId) {
      console.log("[Checkout API] ERROR: No productId - returning 400");
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Get buyer from Clerk ID
    console.log("[Checkout API] Looking up buyer with clerkId:", clerkUserId);
    const buyer = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });
    console.log("[Checkout API] Buyer found:", buyer ? buyer.id : "NOT FOUND");

    if (!buyer) {
      console.log("[Checkout API] ERROR: Buyer not found - returning 404");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get product with seller information
    console.log("[Checkout API] Looking up product:", productId);
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
    console.log("[Checkout API] Product found:", product ? product.title : "NOT FOUND");

    if (!product) {
      console.log("[Checkout API] ERROR: Product not found - returning 404");
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    console.log("[Checkout API] Product isSold:", product.isSold);
    if (product.isSold) {
      console.log("[Checkout API] ERROR: Product already sold - returning 400");
      return NextResponse.json({ error: "Product is already sold" }, { status: 400 });
    }

    // Prevent buying your own product
    console.log(
      "[Checkout API] Checking ownership - product.userId:",
      product.userId,
      "buyer.id:",
      buyer.id
    );
    if (product.userId === buyer.id) {
      console.log("[Checkout API] ERROR: User trying to buy own product - returning 400");
      return NextResponse.json({ error: "Cannot purchase your own product" }, { status: 400 });
    }

    // Get seller's Stripe Connect account
    const seller = product.user;
    console.log(
      "[Checkout API] Seller stripeConnectId:",
      seller.stripeConnectId ? "present" : "MISSING"
    );
    console.log("[Checkout API] Seller stripeOnboardingComplete:", seller.stripeOnboardingComplete);

    if (!seller.stripeConnectId || !seller.stripeOnboardingComplete) {
      console.log("[Checkout API] ERROR: Seller not set up for payments - returning 400");
      return NextResponse.json(
        { error: "Seller is not set up to receive payments" },
        { status: 400 }
      );
    }

    // Calculate Vinted-style pricing (0% seller fee, buyer pays protection fee)
    const productPriceInPence = Math.round(product.price * 100);
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

      // Shipping options - flat rate for MVP, can integrate ShipEngine later
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 499, // £4.99 standard shipping
              currency: "gbp",
            },
            display_name: "Royal Mail Tracked 48",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 2,
              },
              maximum: {
                unit: "business_day",
                value: 4,
              },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 699, // £6.99 express shipping
              currency: "gbp",
            },
            display_name: "Royal Mail Tracked 24",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 1,
              },
              maximum: {
                unit: "business_day",
                value: 2,
              },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 899, // £8.99 next day
              currency: "gbp",
            },
            display_name: "DPD Next Day",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 1,
              },
              maximum: {
                unit: "business_day",
                value: 1,
              },
            },
          },
        },
      ],

      // Phone number collection for shipping
      phone_number_collection: {
        enabled: true,
      },

      // Payment stays on platform account (escrow-style)
      // NO transfer_data - we'll transfer to seller after buyer confirms receipt
      payment_intent_data: {
        metadata: {
          productId: product.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          // Store seller Connect ID for later transfer
          sellerStripeConnectId: seller.stripeConnectId,
          // Store calculated amounts for order creation
          productPriceInPence: productPriceInPence.toString(),
          buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence.toString(),
        },
      },

      // Session metadata for webhook processing
      metadata: {
        productId: product.id,
        sellerId: seller.id,
        buyerId: buyer.id,
        sellerStripeConnectId: seller.stripeConnectId,
        productPriceInPence: productPriceInPence.toString(),
        buyerProtectionFeeInPence: pricing.buyerProtectionFeeInPence.toString(),
      },

      // Return URL after checkout completes
      return_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

      // Customer email for receipt
      customer_email: buyer.email,
    });

    console.log("[Checkout API] SUCCESS - Session created:", session.id);
    console.log("[Checkout API] clientSecret present:", !!session.client_secret);

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
