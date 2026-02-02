import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/orders/by-payment-intent/[paymentIntentId]
 *
 * Fetches order details by Stripe Payment Intent ID.
 * Used by the success page for PaymentElement flow.
 * Returns same format as by-session route for compatibility.
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
    const order = await prisma.order.findFirst({
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
      // Order may still be processing via webhook
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
