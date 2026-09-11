import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { requesterOwnsCheckoutSession } from "@/lib/checkout-session-ownership";
import { stripe } from "@/lib/stripe";
import { createOrderFromCheckoutSession } from "@/lib/create-order-from-checkout-session";

/**
 * Get order details by Stripe Checkout Session ID
 * Used by the success page to display order confirmation
 */
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    // The response includes the buyer's shipping address, so this must be
    // restricted to the order's own buyer or seller — session IDs leak via
    // URLs, browser history and analytics.
    const clerkUserId = await getUserIdFromRequest(req);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, email: true },
    });
    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // First, try to find order by checkout session ID
    const findOrder = () =>
      prisma.order.findFirst({
        where: {
          stripeCheckoutId: sessionId,
          OR: [{ buyerId: requester.id }, { sellerId: requester.id }],
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
          toAddress: true,
          seller: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

    let order = await findOrder();

    // If not found, the webhook might not have processed yet — or the
    // session belongs to someone else. Never disclose Stripe session state
    // (paid / processing / open / expired) to a non-owner.
    if (!order) {
      // Existing order for another party: 404 before any Stripe call.
      const foreignOrder = await prisma.order.findFirst({
        where: { stripeCheckoutId: sessionId },
        select: { id: true },
      });
      if (foreignOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (!requesterOwnsCheckoutSession(session, requester)) {
          return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (session.status === "complete" && session.payment_status === "paid") {
          // Paid, but no order yet. The webhook normally creates it within
          // seconds; when it hasn't (delivery lag, or an environment Stripe
          // can't reach — a preview deployment, say) create it here from the
          // same verified session. It's the webhook's own idempotent path,
          // keyed on the session and payment intent, so a concurrent webhook
          // delivery can't produce a second order — whichever runs second
          // finds the first one's row.
          try {
            await createOrderFromCheckoutSession(session);
          } catch (creationError) {
            console.warn(
              "[Order by session] Fallback order creation failed; the webhook may have won:",
              creationError
            );
          }
          order = await findOrder();

          if (!order) {
            // Still nothing (double-sell refund, or a race we lost to a
            // webhook that is mid-write). Let the client keep polling.
            return NextResponse.json({
              status: "processing",
              message: "Your order is being processed. Please wait a moment.",
              sessionId,
            });
          }
        } else if (session.status === "open") {
          // Session is still open, checkout not completed
          return NextResponse.json({ error: "Checkout not completed" }, { status: 400 });
        } else if (session.status === "expired") {
          return NextResponse.json({ error: "Checkout session expired" }, { status: 400 });
        }
      } catch (stripeError) {
        console.error("Error fetching session from Stripe:", stripeError);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    }

    // Return order details
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
        sellerId: order.seller.id,
        sellerName: `${order.seller.firstName} ${order.seller.lastName}`.trim() || "Seller",
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
    console.error("Error fetching order by session:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
