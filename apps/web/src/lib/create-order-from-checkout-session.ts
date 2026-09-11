import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@buttergolf/db";
import { SHIPPING_OPTIONS } from "@buttergolf/constants";
import { stripe } from "@/lib/stripe";
import {
  sendOrderConfirmationEmail,
  sendNewSaleEmail,
  sendEmail,
  sendPaymentOnHoldEmail,
} from "@/lib/email";
import { generateShippingLabelRecordingFailure } from "@/lib/shipengine";
import { getBaseUrl } from "@/lib/base-url";

/**
 * Create the order for a completed Checkout Session.
 *
 * Called by the Stripe webhook on `checkout.session.completed`, and by the
 * success page's order lookup when a paid session has no order yet (webhook
 * lag, or an environment Stripe cannot reach, such as a preview deployment).
 * Idempotent on the session and payment intent, so both callers can race.
 *
 * Returns the webhook-style response so the webhook route can pass it
 * straight through; other callers ignore it and re-read the order.
 */
export async function createOrderFromCheckoutSession(session: Stripe.Checkout.Session) {
  console.info("Checkout session completed:", {
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
    console.info("Order already exists for session:", session.id);
    return NextResponse.json({
      received: true,
      orderId: existingOrder.id,
      message: "Order already processed",
    });
  }

  // Double-sell guard: a checkout session stays payable for ~24h, so two buyers
  // can complete payment for one item. If another payment already produced an
  // order for this product, this buyer must be refunded rather than sold a
  // second copy. Keying on a *different* payment intent keeps our own webhook
  // retries (which haven't created the order yet) from self-refunding.
  const conflictingOrder = await prisma.order.findFirst({
    where: { productId, stripePaymentId: { not: paymentIntentId } },
  });

  if (conflictingOrder) {
    console.error("Product already sold via another order - refunding duplicate purchase:", {
      productId,
      conflictingOrderId: conflictingOrder.id,
      paymentIntentId,
    });
    try {
      await stripe.refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `double-sell-refund:${paymentIntentId}` }
      );
    } catch (refundError) {
      console.error("Failed to auto-refund duplicate purchase:", refundError);
    }
    // Ack so Stripe stops retrying - the refund is the resolution.
    return NextResponse.json({ received: true, refunded: true, reason: "product_already_sold" });
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

  // The buyer's shipping payment funds the label we buy on their behalf, so it
  // is not the seller's to receive. The seller is paid for the item.
  const sellerPayout = productPriceInPence / 100;

  // Recover which shipping option the buyer picked. Stripe generates its own
  // rate ids for shipping_rate_data, so match on the amount charged — our
  // option prices are distinct by design.
  const shippingAmountInPence = session.shipping_cost?.amount_total ?? 0;
  const chosenOption = SHIPPING_OPTIONS.find(
    (option) => option.priceInPence === shippingAmountInPence
  );

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
  // Create the order and mark the product sold atomically so a crash between
  // the two can't leave a paid-for product still on sale.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        stripePaymentId: paymentIntentId,
        stripeCheckoutId: session.id,
        stripeChargeId,
        amountTotal,
        shippingCost,
        shippingOptionId: chosenOption?.id ?? null,
        shippingServiceName: chosenOption?.name ?? null,
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

    await tx.product.update({
      where: { id: productId },
      data: { isSold: true },
    });

    return created;
  });

  console.info("Order created successfully:", order.id);

  // Link conversation to order if this was an offer-based purchase
  const offerId = session.metadata?.offerId;
  if (offerId) {
    try {
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        select: { conversationId: true },
      });

      if (offer?.conversationId) {
        await prisma.conversation.update({
          where: { id: offer.conversationId },
          data: { orderId: order.id },
        });

        // Create a system message in the conversation
        await prisma.message.create({
          data: {
            content: "Order created — payment confirmed.",
            senderId: buyerId,
            conversationId: offer.conversationId,
            type: "SYSTEM",
          },
        });

        console.info("Linked conversation", offer.conversationId, "to order", order.id);
      }
    } catch (err) {
      // Non-fatal: conversation linking failure shouldn't block order creation
      console.error("Failed to link conversation to order:", err);
    }
  } else {
    // No offer — check if a conversation exists for this buyer+seller+product
    // and link it if so (covers direct purchase after messaging)
    try {
      const conversation = await prisma.conversation.findUnique({
        where: {
          productId_buyerId_sellerId: {
            productId,
            buyerId,
            sellerId,
          },
        },
      });

      if (conversation) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { orderId: order.id },
        });

        await prisma.message.create({
          data: {
            content: "Order created — payment confirmed.",
            senderId: buyerId,
            conversationId: conversation.id,
            type: "SYSTEM",
          },
        });

        console.info("Linked existing conversation", conversation.id, "to order", order.id);
      }
    } catch (err) {
      console.error("Failed to link conversation to order:", err);
    }
  }

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
                Great news! Someone just purchased your item. We can't create the shipping label yet, because we don't have a postage address to send it from.
              </p>
              <p style="color: #323232; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Add your address and we'll generate the label straight away. It's also the return address printed on every label.
              </p>
              <a href="${getBaseUrl()}/account/addresses" style="display: inline-block; background-color: #F45314; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 100px; font-weight: 600; font-size: 16px;">
                Add Your Postage Address
              </a>
              <p style="color: #545454; font-size: 14px; line-height: 1.6; margin-top: 24px;">
                Order ID: <code style="background-color: #EDEDED; padding: 2px 6px; border-radius: 4px;">${order.id}</code>
              </p>
            </div>
          </div>
        `,
      });
      console.info("Sent address required email to seller:", product.user.email);
    } catch (emailError) {
      console.error("Failed to send address required email:", emailError);
    }
  }

  // Attempt to generate the shipping label. Failures are recorded on the order
  // so the seller sees why no label appeared, rather than nothing happening.
  console.info("Attempting to auto-generate shipping label for order:", order.id);
  const labelAttempt = await generateShippingLabelRecordingFailure(order.id);

  if (labelAttempt.status === "ok") {
    console.info("Shipping label generated successfully:", {
      orderId: order.id,
      trackingNumber: labelAttempt.label.trackingNumber,
      carrier: labelAttempt.label.carrier,
    });
    // Label generated email is sent by generateShippingLabel()
  } else {
    console.error("Could not auto-generate shipping label:", {
      orderId: order.id,
      code: labelAttempt.code,
      error: labelAttempt.message,
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

  console.info("Sending order notification emails...", {
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
    console.info("Buyer confirmation email sent:", {
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
    console.info("Seller notification email sent:", {
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
      console.info("Payment on-hold email sent to buyer:", buyer.email);
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
