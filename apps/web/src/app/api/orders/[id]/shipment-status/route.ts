import { NextRequest, NextResponse } from "next/server";
import { prisma, ShipmentStatus } from "@buttergolf/db";
import { calculateAutoReleaseDate } from "@/lib/pricing";
import { sendPaymentOnHoldEmail } from "@/lib/email";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * PATCH /api/orders/[id]/shipment-status
 *
 * Update shipment status for an order.
 *
 * Critical: When status changes to DELIVERED, we set autoReleaseAt to 14 days from now.
 * This starts the buyer's confirmation window - they can confirm receipt to release
 * payment immediately, or payment auto-releases after 14 days.
 *
 * This endpoint can be called by:
 * - Seller manually updating status
 * - Shipping carrier webhook (future implementation)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(request);

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = await request.json();
    const { status } = body as { status: ShipmentStatus };

    // Validate status
    const validStatuses: ShipmentStatus[] = [
      "PENDING",
      "PRE_TRANSIT",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "RETURNED",
      "FAILED",
      "CANCELLED",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Valid shipment status is required" }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get order with buyer info
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        product: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only seller can update shipment status
    if (order.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Only the seller can update shipment status" },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: {
      shipmentStatus: ShipmentStatus;
      shippedAt?: Date;
      deliveredAt?: Date;
      actualDelivery?: Date;
      autoReleaseAt?: Date;
    } = {
      shipmentStatus: status,
    };

    // Set timestamps based on status
    if (status === "IN_TRANSIT" && !order.shippedAt) {
      updateData.shippedAt = new Date();
    }

    // CRITICAL: When delivered, set autoReleaseAt to 14 days from now
    // This is when the buyer's confirmation window starts
    if (status === "DELIVERED") {
      const now = new Date();
      updateData.deliveredAt = now;
      updateData.actualDelivery = now;
      updateData.autoReleaseAt = calculateAutoReleaseDate(now);

      console.info("Setting auto-release date for delivered order:", {
        orderId,
        deliveredAt: now,
        autoReleaseAt: updateData.autoReleaseAt,
      });
    }

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    console.info("Order shipment status updated:", {
      orderId,
      oldStatus: order.shipmentStatus,
      newStatus: status,
      autoReleaseAt: updatedOrder.autoReleaseAt,
    });

    // If delivered, send payment on-hold email to buyer
    // This explains their 14-day window to confirm receipt
    if (status === "DELIVERED" && updatedOrder.autoReleaseAt) {
      try {
        await sendPaymentOnHoldEmail({
          buyerEmail: order.buyer.email,
          buyerName: order.buyer.firstName || "Customer",
          orderId,
          productTitle: order.product.title,
          autoReleaseDate: updatedOrder.autoReleaseAt,
        });
        console.info("Payment on-hold email sent to buyer:", order.buyer.email);
      } catch (emailError) {
        // Log but don't fail the request
        console.error("Failed to send payment on-hold email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      shipmentStatus: updatedOrder.shipmentStatus,
      autoReleaseAt: updatedOrder.autoReleaseAt,
      deliveredAt: updatedOrder.deliveredAt,
    });
  } catch (error) {
    console.error("Error updating shipment status:", error);
    return NextResponse.json({ error: "Failed to update shipment status" }, { status: 500 });
  }
}
