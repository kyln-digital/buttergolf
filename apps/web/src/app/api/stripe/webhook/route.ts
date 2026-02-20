import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@buttergolf/db";
import { stripe } from "@/lib/stripe";
import {
  sendOrderConfirmationEmail,
  sendNewSaleEmail,
  sendEmail,
  sendPaymentOnHoldEmail,
} from "@/lib/email";
import { generateShippingLabel } from "@/lib/shipengine";

// Disable body parsing for webhook
export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhooks for the checkout/payment flow.
 * This is SEPARATE from the Connect webhook (/api/stripe/connect/webhook).
 *
 * Events handled:
 * - checkout.session.completed: Primary event - creates order, sends emails
 * - checkout.session.expired: Logs expired checkouts (inventory release if needed)
 * - payment_intent.succeeded: Fallback for non-checkout payments
 * - payment_intent.payment_failed: Log payment failures
 * - charge.refunded: Handle refunds, restore product availability
 * - charge.dispute.created: Alert on chargebacks
 * - charge.dispute.closed: Track dispute resolution
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  try {
    const body = await req.text();
    const headerPayload = await headers();
    const signature = headerPayload.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        {
          error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 400 }
      );
    }

    console.log("Stripe webhook event received:", event.type);

    // Handle events with switch for cleaner organization
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return await handleCheckoutCompleted(session);
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        handleCheckoutExpired(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        handlePaymentFailed(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        handleDisputeCreated(dispute);
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        handleDisputeClosed(dispute);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// ============================================================================
// CHECKOUT SESSION HANDLERS
// ============================================================================

/**
 * Handle checkout.session.completed event (primary event for Embedded Checkout)
 * Creates order, sends confirmation emails to buyer and seller
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("Checkout session completed:", {
    id: session.id,
    paymentIntentId: session.payment_intent,
    amountTotal: session.amount_total,
    metadata: session.metadata,
  });

  // Extract metadata
  const { productId, sellerId, buyerId } = session.metadata || {};

  if (!productId || !sellerId || !buyerId) {
    console.error("Missing required metadata in checkout session:", session.metadata);
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  // Get payment intent ID
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    console.error("Missing payment intent ID in session");
    return NextResponse.json({ error: "Missing payment intent" }, { status: 400 });
  }

  // Idempotency check - don't process twice
  const existingOrder = await prisma.order.findFirst({
    where: {
      OR: [{ stripePaymentId: paymentIntentId }, { stripeCheckoutId: session.id }],
    },
  });

  if (existingOrder) {
    console.log("Order already exists for session:", session.id);
    return NextResponse.json({
      received: true,
      orderId: existingOrder.id,
      message: "Order already processed",
    });
  }

  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      user: {
        include: {
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  });

  if (!product) {
    console.error("Product not found:", productId);
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Get buyer information
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
  });

  if (!buyer) {
    console.error("Buyer not found:", buyerId);
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  // Get shipping details from the session
  // Note: Stripe API 2025-11-17+ puts shipping under collected_information.shipping_details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionAny = session as any;
  const shippingDetails = (sessionAny.collected_information?.shipping_details || // New API location
    sessionAny.shipping_details) as  // Legacy fallback
    | {
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        };
        name?: string;
      }
    | undefined;
  const customerDetails = session.customer_details;

  if (!shippingDetails?.address) {
    console.error("Missing shipping details in session. Available fields:", {
      hasCollectedInfo: !!sessionAny.collected_information,
      hasShippingDetails: !!sessionAny.shipping_details,
      collectedInfoKeys: Object.keys(sessionAny.collected_information || {}),
    });
    return NextResponse.json({ error: "Missing shipping details" }, { status: 400 });
  }

  // Create buyer's shipping address (To Address)
  const toAddress = await prisma.address.create({
    data: {
      userId: buyerId,
      name: shippingDetails.name || `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email,
      street1: shippingDetails.address.line1 || "",
      street2: shippingDetails.address.line2 || undefined,
      city: shippingDetails.address.city || "",
      state: shippingDetails.address.state || "",
      zip: shippingDetails.address.postal_code || "",
      country: shippingDetails.address.country || "GB",
      phone: customerDetails?.phone || undefined,
    },
  });

  // Get seller's default address (From Address)
  let fromAddress = product.user.addresses[0];
  let sellerNeedsAddress = false;

  if (!fromAddress) {
    // CRITICAL: Seller has no address - this should not happen if Stripe Connect onboarding is complete
    // Create minimal placeholder so order can be created, but flag for manual intervention
    console.error("Seller has no address - this indicates incomplete Stripe Connect onboarding:", {
      sellerId,
      sellerEmail: product.user.email,
      productId,
    });

    fromAddress = await prisma.address.create({
      data: {
        userId: sellerId,
        name: `${product.user.firstName} ${product.user.lastName}`.trim() || product.user.email,
        street1: "Address pending",
        city: "Pending",
        state: "",
        zip: "XX00 0XX",
        country: "GB",
        isDefault: true,
      },
    });

    sellerNeedsAddress = true;
  }

  // Calculate amounts from session and metadata
  const amountTotal = (session.amount_total || 0) / 100; // Convert from pence
  const shippingCost = (session.shipping_cost?.amount_total || 0) / 100;

  // Vinted-style pricing: extract buyer protection fee from metadata
  // Seller receives 100% of product price + shipping (0% platform fee)
  const buyerProtectionFeeInPence = parseInt(
    session.metadata?.buyerProtectionFeeInPence || "0",
    10
  );
  const productPriceInPence = parseInt(session.metadata?.productPriceInPence || "0", 10);
  const buyerProtectionFee = buyerProtectionFeeInPence / 100;

  // Seller gets 100% of product + shipping
  const sellerPayout = productPriceInPence / 100 + shippingCost;

  // Get charge ID from payment intent for later transfer
  let stripeChargeId: string | null = null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    stripeChargeId =
      typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id || null;
  } catch {
    console.warn("Could not retrieve charge ID from payment intent");
  }

  // autoReleaseAt starts as null - will be set to 14 days after delivery
  // when shipmentStatus changes to DELIVERED
  const autoReleaseAt = null;

  // Create the order with HELD status (escrow-style)
  // Note: paymentHoldStatus is explicitly set to HELD even though the schema has this as default.
  // This is intentional for code clarity - makes the escrow intent obvious without needing
  // to check the schema. The default serves as a safety net for any edge cases.
  const order = await prisma.order.create({
    data: {
      stripePaymentId: paymentIntentId,
      stripeCheckoutId: session.id,
      stripeChargeId,
      amountTotal,
      shippingCost,
      // Vinted-style: buyer protection fee as platform revenue
      buyerProtectionFee,
      stripePlatformFee: buyerProtectionFee, // For backwards compatibility
      stripeSellerPayout: sellerPayout,
      stripePayoutStatus: "pending",
      // Payment hold (escrow) - explicitly set for clarity (schema default is also HELD)
      paymentHoldStatus: "HELD",
      paymentHeldAt: new Date(),
      autoReleaseAt,
      sellerId,
      buyerId,
      productId,
      fromAddressId: fromAddress.id,
      toAddressId: toAddress.id,
      shipmentStatus: "PENDING",
      status: "PAYMENT_CONFIRMED",
    },
  });

  // Mark product as sold
  await prisma.product.update({
    where: { id: productId },
    data: { isSold: true },
  });

  console.log("Order created successfully:", order.id);

  // Send email to seller if they need to complete their address
  if (sellerNeedsAddress) {
    try {
      await sendEmail({
        to: product.user.email,
        subject: "Action Required: Complete Your Seller Profile",
        html: `
          <div style="font-family: 'Urbanist', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #F45314; padding: 24px; text-align: center;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Address Required</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                Hi ${product.user.firstName || "there"},
              </p>
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                Great news! Someone just purchased your item. However, we cannot generate a shipping label because your shipping address is not set up.
              </p>
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Please complete your Stripe Connect profile to add your address. This address will be used as the return address on all shipping labels.
              </p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/sell" style="display: inline-block; background-color: #F45314; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 100px; font-weight: 600; font-size: 16px;">
                Complete Your Profile
              </a>
              <p style="color: #545454; font-size: 14px; line-height: 1.6; margin-top: 24px;">
                Order ID: <code style="background-color: #EDEDED; padding: 2px 6px; border-radius: 4px;">${order.id}</code>
              </p>
            </div>
          </div>
        `,
      });
      console.log("Sent address required email to seller:", product.user.email);
    } catch (emailError) {
      console.error("Failed to send address required email:", emailError);
    }
  }

  // Attempt to generate shipping label automatically
  // (will fail gracefully if seller has no valid address)
  try {
    console.log("Attempting to auto-generate shipping label for order:", order.id);

    const labelResult = await generateShippingLabel({
      orderId: order.id,
    });

    console.log("Shipping label generated successfully:", {
      orderId: order.id,
      trackingNumber: labelResult.trackingNumber,
      carrier: labelResult.carrier,
    });

    // Label generated email is sent by generateShippingLabel()
  } catch (labelError) {
    // Don't fail the order if label generation fails
    // Seller will need to generate manually later
    console.warn("Could not auto-generate shipping label:", {
      orderId: order.id,
      error: labelError instanceof Error ? labelError.message : "Unknown error",
      reason: "Seller may need to update their address first",
    });
  }

  // Send notification emails
  await sendOrderEmails(
    order.id,
    amountTotal,
    buyer,
    product,
    shippingDetails,
    sellerPayout,
    autoReleaseAt
  );

  return NextResponse.json({
    received: true,
    orderId: order.id,
  });
}

/**
 * Send confirmation emails to buyer and notification to seller
 */
async function sendOrderEmails(
  orderId: string,
  amountTotal: number,
  buyer: { email: string; firstName: string | null; lastName: string | null },
  product: {
    title: string;
    user: { email: string; firstName: string | null; lastName: string | null };
    images?: { url: string }[];
  },
  shippingDetails: { address?: { city?: string; postal_code?: string } },
  sellerPayout: number,
  autoReleaseAt: Date | null
) {
  const buyerName = `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email;
  const sellerName =
    `${product.user.firstName} ${product.user.lastName}`.trim() || product.user.email;

  console.log("Sending order notification emails...", {
    orderId,
    buyerEmail: buyer.email,
    sellerEmail: product.user.email,
    hasResendApiKey: !!process.env.RESEND_API_KEY,
  });

  // Send order confirmation to buyer
  const buyerEmailResult = await sendOrderConfirmationEmail({
    buyerEmail: buyer.email,
    buyerName,
    orderId,
    productTitle: product.title,
    productImage: product.images?.[0]?.url,
    amountTotal,
    sellerName,
  });

  if (buyerEmailResult.success) {
    console.log("Buyer confirmation email sent:", {
      orderId,
      emailId: buyerEmailResult.id,
      recipient: buyer.email,
    });
  } else {
    console.error("Failed to send buyer confirmation email:", {
      orderId,
      recipient: buyer.email,
      error: buyerEmailResult.error,
    });
  }

  // Send new sale notification to seller
  const sellerEmailResult = await sendNewSaleEmail({
    sellerEmail: product.user.email,
    sellerName,
    orderId,
    productTitle: product.title,
    buyerName,
    amountTotal,
    sellerPayout,
    shippingAddress: {
      city: shippingDetails.address?.city || "",
      zip: shippingDetails.address?.postal_code || "",
    },
  });

  if (sellerEmailResult.success) {
    console.log("Seller notification email sent:", {
      orderId,
      emailId: sellerEmailResult.id,
      recipient: product.user.email,
    });
  } else {
    console.error("Failed to send seller notification email:", {
      orderId,
      recipient: product.user.email,
      error: sellerEmailResult.error,
    });
  }

  // Send buyer protection / payment on hold email to buyer
  // Only send if autoReleaseAt is set (meaning item has been delivered)
  // For now, we skip this email at checkout since the countdown hasn't started
  if (autoReleaseAt) {
    try {
      await sendPaymentOnHoldEmail({
        buyerEmail: buyer.email,
        buyerName,
        orderId,
        productTitle: product.title,
        autoReleaseDate: autoReleaseAt,
      });
      console.log("Payment on-hold email sent to buyer:", buyer.email);
    } catch (holdEmailError) {
      // Log but don't fail - this is a secondary email
      console.error("Failed to send payment on-hold email:", holdEmailError);
    }
  }
}

/**
 * Handle checkout.session.expired
 * Currently just logs - can release reserved inventory if implementing hold system
 */
function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const { productId } = session.metadata || {};

  console.log("⏰ Checkout session expired:", {
    sessionId: session.id,
    productId: productId || "none",
  });

  // If we implement inventory hold during checkout, release it here
  // Currently products aren't reserved until checkout completes
}

// ============================================================================
// PROMOTION HANDLERS
// ============================================================================

/**
 * Handle promotion payment succeeded
 * Activates the pending promotion when payment completes
 */
async function handlePromotionPayment(paymentIntent: Stripe.PaymentIntent) {
  const { productId, promotionType, durationMs } = paymentIntent.metadata;

  console.log("Promotion payment succeeded:", {
    paymentIntentId: paymentIntent.id,
    productId,
    promotionType,
  });

  if (!productId || !promotionType) {
    console.error("Missing promotion metadata:", paymentIntent.metadata);
    return;
  }

  // Find the pending promotion with retry logic
  // The webhook may fire before the POST handler creates the promotion record
  const maxAttempts = 5;
  const baseDelayMs = 200;
  let promotion: Awaited<ReturnType<typeof prisma.productPromotion.findFirst>> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    promotion = await prisma.productPromotion.findFirst({
      where: {
        stripePaymentId: paymentIntent.id,
        status: "PENDING",
      },
    });

    if (promotion) {
      break;
    }

    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn("Pending promotion not found, retrying...", {
        paymentIntentId: paymentIntent.id,
        attempt,
        maxAttempts,
        delayMs: delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!promotion) {
    console.error("Pending promotion not found after retries:", paymentIntent.id);
    return;
  }

  // Calculate promotion timing
  const now = new Date();
  const durationMsNum = parseInt(durationMs || "86400000", 10); // Default 24 hours
  const expiresAt = new Date(now.getTime() + durationMsNum);

  // Activate the promotion
  await prisma.productPromotion.update({
    where: { id: promotion.id },
    data: {
      status: "ACTIVE",
      startsAt: now,
      expiresAt,
    },
  });

  console.log("Promotion activated:", {
    promotionId: promotion.id,
    productId,
    type: promotionType,
    expiresAt,
  });

  // TODO: Send confirmation email to seller
}

// ============================================================================
// PAYMENT INTENT HANDLERS
// ============================================================================

/**
 * Handle payment_intent.succeeded
 * This handles:
 * 1. Payments already processed by checkout.session.completed (idempotent)
 * 2. PaymentElement flow payments (BuyNowSheet) - creates order here
 * 3. Promotion purchases - activates the promotion
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { source } = paymentIntent.metadata;

  // Handle promotion purchases
  if (source === "promotion_purchase") {
    await handlePromotionPayment(paymentIntent);
    return;
  }

  // Check if this was already handled by checkout.session.completed
  const existingOrder = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (existingOrder) {
    console.log("Payment intent succeeded (already handled by checkout):", paymentIntent.id);
    return;
  }

  // Check if this is from our PaymentElement flow
  const { productId, sellerId, buyerId } = paymentIntent.metadata;

  if (source !== "payment_element") {
    // Payment intent without matching order and not from PaymentElement - likely from legacy flow
    console.log("Payment intent succeeded without checkout session (legacy):", {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });
    return;
  }

  // This is from PaymentElement flow - create the order
  console.log("Payment intent succeeded from PaymentElement flow:", {
    id: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    productId,
    buyerId,
    sellerId,
  });

  if (!productId || !sellerId || !buyerId) {
    console.error("Missing required metadata in payment intent:", paymentIntent.metadata);
    return;
  }

  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      user: {
        include: {
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  });

  if (!product) {
    console.error("Product not found:", productId);
    return;
  }

  // Get buyer information
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
  });

  if (!buyer) {
    console.error("Buyer not found:", buyerId);
    return;
  }

  // Get shipping details from the payment intent
  const shippingDetails = paymentIntent.shipping;

  if (!shippingDetails?.address) {
    console.error("Missing shipping details in payment intent");
    return;
  }

  // Create buyer's shipping address (To Address)
  const toAddress = await prisma.address.create({
    data: {
      userId: buyerId,
      name: shippingDetails.name || `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email,
      street1: shippingDetails.address.line1 || "",
      street2: shippingDetails.address.line2 || undefined,
      city: shippingDetails.address.city || "",
      state: shippingDetails.address.state || "",
      zip: shippingDetails.address.postal_code || "",
      country: shippingDetails.address.country || "GB",
      phone: shippingDetails.phone || undefined,
    },
  });

  // Get seller's default address (From Address)
  let fromAddress = product.user.addresses[0];
  let sellerNeedsAddress = false;

  if (!fromAddress) {
    console.error("Seller has no address:", { sellerId, productId });

    fromAddress = await prisma.address.create({
      data: {
        userId: sellerId,
        name: `${product.user.firstName} ${product.user.lastName}`.trim() || product.user.email,
        street1: "Address pending",
        city: "Pending",
        state: "",
        zip: "XX00 0XX",
        country: "GB",
        isDefault: true,
      },
    });

    sellerNeedsAddress = true;
  }

  // Calculate amounts from payment intent metadata (Vinted-style pricing)
  const amountTotal = paymentIntent.amount / 100;
  const shippingAmountInPence = parseInt(paymentIntent.metadata.shippingAmountInPence || "0", 10);
  const shippingCost = shippingAmountInPence / 100;

  // Vinted-style pricing: extract buyer protection fee from metadata
  const buyerProtectionFeeInPence = parseInt(
    paymentIntent.metadata.buyerProtectionFeeInPence || "0",
    10
  );
  const sellerPayoutInPence = parseInt(paymentIntent.metadata.sellerPayoutInPence || "0", 10);
  const buyerProtectionFee = buyerProtectionFeeInPence / 100;
  const sellerPayout = sellerPayoutInPence / 100;

  // Get charge ID for later transfer
  const stripeChargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id || null;

  // autoReleaseAt starts as null - will be set to 14 days after delivery
  // when shipmentStatus changes to DELIVERED
  const autoReleaseAt = null;

  // Create the order with HELD status (escrow-style)
  const order = await prisma.order.create({
    data: {
      stripePaymentId: paymentIntent.id,
      stripeCheckoutId: null, // No checkout session for PaymentElement flow
      stripeChargeId,
      amountTotal,
      shippingCost,
      // Vinted-style: buyer protection fee as platform revenue
      buyerProtectionFee,
      stripePlatformFee: buyerProtectionFee, // For backwards compatibility
      stripeSellerPayout: sellerPayout,
      stripePayoutStatus: "pending",
      // Payment hold (escrow) - seller paid after buyer confirms
      paymentHoldStatus: "HELD",
      paymentHeldAt: new Date(),
      autoReleaseAt,
      sellerId,
      buyerId,
      productId,
      fromAddressId: fromAddress.id,
      toAddressId: toAddress.id,
      shipmentStatus: "PENDING",
      status: "PAYMENT_CONFIRMED",
    },
  });

  // Mark product as sold
  await prisma.product.update({
    where: { id: productId },
    data: { isSold: true },
  });

  console.log("Order created successfully from PaymentElement flow:", order.id);

  // Send email to seller if they need to complete their address
  if (sellerNeedsAddress) {
    try {
      await sendEmail({
        to: product.user.email,
        subject: "Action Required: Complete Your Seller Profile",
        html: `
          <div style="font-family: 'Urbanist', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #F45314; padding: 24px; text-align: center;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Address Required</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                Hi ${product.user.firstName || "there"},
              </p>
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                Great news! Someone just purchased your item. However, we cannot generate a shipping label because your shipping address is not set up.
              </p>
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Please complete your Stripe Connect profile to add your address. This address will be used as the return address on all shipping labels.
              </p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/sell" style="display: inline-block; background-color: #F45314; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 100px; font-weight: 600; font-size: 16px;">
                Complete Your Profile
              </a>
              <p style="color: #545454; font-size: 14px; line-height: 1.6; margin-top: 24px;">
                Order ID: <code style="background-color: #EDEDED; padding: 2px 6px; border-radius: 4px;">${order.id}</code>
              </p>
            </div>
          </div>
        `,
      });
      console.log("Sent address required email to seller:", product.user.email);
    } catch (emailError) {
      console.error("Failed to send address required email:", emailError);
    }
  }

  // Attempt to generate shipping label automatically
  try {
    console.log("Attempting to auto-generate shipping label for order:", order.id);

    const labelResult = await generateShippingLabel({
      orderId: order.id,
    });

    console.log("Shipping label generated successfully:", {
      orderId: order.id,
      trackingNumber: labelResult.trackingNumber,
      carrier: labelResult.carrier,
    });
  } catch (labelError) {
    console.warn("Could not auto-generate shipping label:", {
      orderId: order.id,
      error: labelError instanceof Error ? labelError.message : "Unknown error",
    });
  }

  // Send notification emails
  await sendOrderEmails(
    order.id,
    amountTotal,
    buyer,
    product,
    {
      address: {
        city: shippingDetails.address.city,
        postal_code: shippingDetails.address.postal_code,
      },
    },
    sellerPayout,
    autoReleaseAt
  );
}

/**
 * Handle payment_intent.payment_failed
 * Log failed payment attempts for monitoring
 */
function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.error("Payment failed:", {
    id: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    lastError: paymentIntent.last_payment_error?.message,
    metadata: paymentIntent.metadata,
  });

  // Could notify buyer/seller or implement retry logic here
}

// ============================================================================
// REFUND & DISPUTE HANDLERS
// ============================================================================

/**
 * Handle charge.refunded
 * Update order status and optionally restore product availability
 */
async function handleRefund(charge: Stripe.Charge) {
  console.log("💸 Charge refunded:", {
    chargeId: charge.id,
    paymentIntentId: charge.payment_intent,
    amountRefunded: (charge.amount_refunded || 0) / 100,
    currency: charge.currency,
    refunded: charge.refunded,
  });

  // Find the order by payment intent
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn("No payment intent ID on refunded charge");
    return;
  }

  const order = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntentId },
    include: { product: true },
  });

  if (!order) {
    console.warn("Order not found for refunded charge:", paymentIntentId);
    return;
  }

  // Update order status (REFUNDED for full refund, keep current for partial)
  if (charge.refunded) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });
  } else {
    // Partial refund - log but don't change status (could add PARTIALLY_REFUNDED to enum later)
    console.log("Partial refund processed for order:", order.id);
  }

  // If fully refunded, restore product availability
  if (charge.refunded) {
    await prisma.product.update({
      where: { id: order.productId },
      data: { isSold: false },
    });
    console.log("Product restored to available:", order.productId);
  }

  // TODO: Send refund confirmation email to buyer
  // TODO: Notify seller of refund
}

/**
 * Handle charge.dispute.created
 * Alert on chargebacks - critical for marketplace operations
 */
function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.error("DISPUTE CREATED:", {
    disputeId: dispute.id,
    chargeId: dispute.charge,
    amount: dispute.amount / 100,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
  });

  // TODO: Notify platform admin
  // TODO: Hold seller payout if not already done
  // TODO: Send dispute notification to seller
}

/**
 * Handle charge.dispute.closed
 * Track dispute resolution outcome
 */
function handleDisputeClosed(dispute: Stripe.Dispute) {
  console.log("Dispute closed:", {
    disputeId: dispute.id,
    chargeId: dispute.charge,
    status: dispute.status, // won, lost, warning_closed, etc.
    amount: dispute.amount / 100,
  });

  // TODO: If lost, update order status
  // TODO: If won, release any held seller payouts
  // TODO: Notify seller of outcome
}
