import { NextRequest, NextResponse } from "next/server";
import { prisma, ShipmentStatus, OrderStatus } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * What a seller may set by hand.
 *
 * Deliberately excludes DELIVERED and the terminal states. Marking an order
 * delivered starts the 14-day auto-release clock, so allowing a seller to
 * declare it lets them be paid for a parcel they never sent. Delivery is
 * asserted by the carrier webhook or confirmed by the buyer — never by the
 * person receiving the money.
 */
const SELLER_SETTABLE_STATUSES: ShipmentStatus[] = ["PRE_TRANSIT", "IN_TRANSIT"];

/**
 * Keep Order.status in step with the shipment. Mirrors the mapping the
 * ShipEngine webhook uses, so a manual update and a carrier event leave the
 * order in the same place.
 */
function mapShipmentToOrderStatus(shipmentStatus: ShipmentStatus): OrderStatus {
  switch (shipmentStatus) {
    case "DELIVERED":
      return "DELIVERED";
    case "PRE_TRANSIT":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "SHIPPED";
    default:
      // FAILED / RETURNED / CANCELLED / PENDING stay put until resolved.
      return "LABEL_GENERATED";
  }
}

/**
 * PATCH /api/orders/[id]/shipment-status
 *
 * Lets a seller record that they have posted an order.
 *
 * Only PRE_TRANSIT and IN_TRANSIT are accepted — see
 * SELLER_SETTABLE_STATUSES. Delivery, and the auto-release clock it starts,
 * are handled by the ShipEngine webhook (carrier-verified) and by the buyer
 * confirming receipt.
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

    if (!status || !SELLER_SETTABLE_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Sellers can only set: ${SELLER_SETTABLE_STATUSES.join(", ")}. Delivery is confirmed by the carrier or the buyer.`,
        },
        { status: 400 }
      );
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

    // Build update data. Order.status has to move with the shipment, or the
    // seller's card shows "Shipped" until the page reloads and the row still
    // says LABEL_GENERATED.
    const updateData: {
      shipmentStatus: ShipmentStatus;
      status?: OrderStatus;
      shippedAt?: Date;
    } = {
      shipmentStatus: status,
      status: mapShipmentToOrderStatus(status),
    };

    // Set timestamps based on status
    if (status === "IN_TRANSIT" && !order.shippedAt) {
      updateData.shippedAt = new Date();
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
    });

    return NextResponse.json({
      success: true,
      orderId,
      status: updatedOrder.status,
      shipmentStatus: updatedOrder.shipmentStatus,
    });
  } catch (error) {
    console.error("Error updating shipment status:", error);
    return NextResponse.json({ error: "Failed to update shipment status" }, { status: 500 });
  }
}
