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

/**
 * Creates an order from a succeeded PaymentIntent (PaymentElement flow).
 *
 * This is shared between:
 * - The Stripe webhook handler (payment_intent.succeeded)
 * - The by-payment-intent API route (fallback when webhook is missed/delayed)
 *
 * It is idempotent: if an order already exists for this PaymentIntent, it returns the existing order.
 */
export async function createOrderFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const { productId, sellerId, buyerId, source } = paymentIntent.metadata;

  // Only handle PaymentElement flow
  if (source !== "payment_element") {
    return null;
  }

  if (!productId || !sellerId || !buyerId) {
    console.error(
      "[createOrderFromPaymentIntent] Missing required metadata:",
      paymentIntent.metadata
    );
    return null;
  }

  // Idempotency check - don't create twice
  const existingOrder = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (existingOrder) {
    return existingOrder;
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
    console.error("[createOrderFromPaymentIntent] Product not found:", productId);
    return null;
  }

  // Get buyer information
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
  });

  if (!buyer) {
    console.error("[createOrderFromPaymentIntent] Buyer not found:", buyerId);
    return null;
  }

  // Get shipping details from the payment intent
  const shippingDetails = paymentIntent.shipping;

  if (!shippingDetails?.address) {
    console.error("[createOrderFromPaymentIntent] Missing shipping details in payment intent");
    return null;
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
    console.error("[createOrderFromPaymentIntent] Seller has no address:", {
      sellerId,
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

  // Calculate amounts from payment intent metadata (Vinted-style pricing)
  const amountTotal = paymentIntent.amount / 100;
  const shippingAmountInPence = parseInt(paymentIntent.metadata.shippingAmountInPence || "0", 10);
  const shippingCost = shippingAmountInPence / 100;

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

  const autoReleaseAt = null;

  // Create the order with HELD status (escrow-style)
  const order = await prisma.order.create({
    data: {
      stripePaymentId: paymentIntent.id,
      stripeCheckoutId: null,
      stripeChargeId,
      amountTotal,
      shippingCost,
      buyerProtectionFee,
      stripePlatformFee: buyerProtectionFee,
      stripeSellerPayout: sellerPayout,
      stripePayoutStatus: "pending",
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

  console.log("[createOrderFromPaymentIntent] Order created successfully:", order.id);

  // Fire-and-forget: send emails, generate label, handle seller address notification
  // These shouldn't block the order response
  handlePostOrderTasks(
    order.id,
    amountTotal,
    buyer,
    product,
    shippingDetails,
    sellerPayout,
    autoReleaseAt,
    sellerNeedsAddress
  ).catch((err) => {
    console.error("[createOrderFromPaymentIntent] Post-order tasks failed:", err);
  });

  return order;
}

/**
 * Handles post-order tasks: emails, shipping label, seller notifications.
 * Runs after order creation and should not block the response.
 */
async function handlePostOrderTasks(
  orderId: string,
  amountTotal: number,
  buyer: { email: string; firstName: string | null; lastName: string | null },
  product: {
    title: string;
    user: { email: string; firstName: string | null; lastName: string | null };
    images?: { url: string }[];
  },
  shippingDetails: Stripe.PaymentIntent.Shipping,
  sellerPayout: number,
  autoReleaseAt: Date | null,
  sellerNeedsAddress: boolean
) {
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
                Please complete your Stripe Connect profile to add your address.
              </p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/sell" style="display: inline-block; background-color: #F45314; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 100px; font-weight: 600; font-size: 16px;">
                Complete Your Profile
              </a>
              <p style="color: #545454; font-size: 14px; line-height: 1.6; margin-top: 24px;">
                Order ID: <code style="background-color: #EDEDED; padding: 2px 6px; border-radius: 4px;">${orderId}</code>
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "[createOrderFromPaymentIntent] Failed to send address required email:",
        emailError
      );
    }
  }

  // Attempt to generate shipping label automatically
  try {
    const labelResult = await generateShippingLabel({ orderId });
    console.log("[createOrderFromPaymentIntent] Shipping label generated:", {
      orderId,
      trackingNumber: labelResult.trackingNumber,
      carrier: labelResult.carrier,
    });
  } catch (labelError) {
    console.warn("[createOrderFromPaymentIntent] Could not auto-generate shipping label:", {
      orderId,
      error: labelError instanceof Error ? labelError.message : "Unknown error",
    });
  }

  // Send notification emails
  const buyerName = `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email;
  const sellerName =
    `${product.user.firstName} ${product.user.lastName}`.trim() || product.user.email;

  const buyerEmailResult = await sendOrderConfirmationEmail({
    buyerEmail: buyer.email,
    buyerName,
    orderId,
    productTitle: product.title,
    productImage: product.images?.[0]?.url,
    amountTotal,
    sellerName,
  });

  if (!buyerEmailResult.success) {
    console.error(
      "[createOrderFromPaymentIntent] Failed to send buyer email:",
      buyerEmailResult.error
    );
  }

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

  if (!sellerEmailResult.success) {
    console.error(
      "[createOrderFromPaymentIntent] Failed to send seller email:",
      sellerEmailResult.error
    );
  }

  if (autoReleaseAt) {
    try {
      await sendPaymentOnHoldEmail({
        buyerEmail: buyer.email,
        buyerName,
        orderId,
        productTitle: product.title,
        autoReleaseDate: autoReleaseAt,
      });
    } catch (holdEmailError) {
      console.error(
        "[createOrderFromPaymentIntent] Failed to send payment on-hold email:",
        holdEmailError
      );
    }
  }
}
