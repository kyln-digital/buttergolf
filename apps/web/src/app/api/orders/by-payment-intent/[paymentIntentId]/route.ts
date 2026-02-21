import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createOrderFromPaymentIntent } from "@/lib/create-order-from-payment-intent";

/**
 * GET /api/orders/by-payment-intent/[paymentIntentId]
 *
 * Fetches order details by Stripe Payment Intent ID.
 * Used by the success page for PaymentElement flow.
 * Returns same format as by-session route for compatibility.
 *
 * If no order exists yet (webhook delayed/missed), this route will
 * verify the PaymentIntent with Stripe and create the order as a fallback.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentIntentId: string }> }
) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(request);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentIntentId } = await params;

    // Get buyer from Clerk ID
    const buyer = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!buyer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find order by payment intent ID
    let order = await prisma.order.findFirst({
      where: {
        stripePaymentId: paymentIntentId,
      },
      include: {
        product: {
          include: {
            images: {
              orderBy: { sortOrder: "asc" },
              take: 1,
            },
            brand: true,
          },
        },
        seller: true,
        toAddress: true,
      },
    });

    if (!order) {
      // Order not yet created - check if webhook was missed by verifying with Stripe
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === "succeeded") {
          // Payment succeeded but webhook was missed/delayed - create order as fallback
          console.log(
            "[by-payment-intent] Webhook missed, creating order from PaymentIntent:",
            paymentIntentId
          );
          const createdOrder = await createOrderFromPaymentIntent(paymentIntent);

          if (createdOrder) {
            // Re-fetch with full includes for the response
            order = await prisma.order.findFirst({
              where: { stripePaymentId: paymentIntentId },
              include: {
                product: {
                  include: {
                    images: {
                      orderBy: { sortOrder: "asc" },
                      take: 1,
                    },
                    brand: true,
                  },
                },
                seller: true,
                toAddress: true,
              },
            });
          }
        }
      } catch (stripeError) {
        console.error("[by-payment-intent] Error checking PaymentIntent with Stripe:", stripeError);
      }
    }

    if (!order) {
      // Still no order - payment may genuinely still be processing
      return NextResponse.json({
        status: "processing",
        message: "Order is being processed",
      });
    }

    // Verify user owns this order (either buyer or seller)
    if (order.buyerId !== buyer.id && order.sellerId !== buyer.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Return same format as by-session route
    return NextResponse.json({
      status: "complete",
      order: {
        id: order.id,
        productTitle: order.product.title,
        productImage: order.product.images[0]?.url || null,
        productBrand: order.product.brand?.name || null,
        amountTotal: order.amountTotal,
        shippingCost: order.shippingCost,
        buyerProtectionFee: order.buyerProtectionFee,
        paymentHoldStatus: order.paymentHoldStatus,
        autoReleaseAt: order.autoReleaseAt?.toISOString() || null,
        trackingCode: order.trackingCode,
        trackingUrl: order.trackingUrl,
        carrier: order.carrier,
        service: order.service,
        orderStatus: order.status,
        shipmentStatus: order.shipmentStatus,
        sellerName:
          `${order.seller.firstName || ""} ${order.seller.lastName || ""}`.trim() ||
          order.seller.email,
        sellerId: order.sellerId,
        shippingAddress: {
          name: order.toAddress.name,
          street1: order.toAddress.street1,
          street2: order.toAddress.street2,
          city: order.toAddress.city,
          state: order.toAddress.state,
          zip: order.toAddress.zip,
          country: order.toAddress.country,
        },
        createdAt: order.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching order by payment intent:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
