import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getOrderTracking } from "@/lib/shipengine";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/tracking
 *
 * Fetch real-time tracking information for an order from ShipEngine
 *
 * Authorization: Buyer or Seller only
 * Caching: Response cached for 5 minutes
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: orderId } = await params;

    // Fetch order with minimal data
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        trackingCode: true,
        trackingUrl: true,
        carrier: true,
        service: true,
        estimatedDelivery: true,
        shipmentStatus: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Authorization check: buyer or seller only
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ error: "Not authorized to view this order" }, { status: 403 });
    }

    // Return early if no tracking code
    if (!order.trackingCode) {
      return NextResponse.json({
        order: {
          id: order.id,
          trackingCode: null,
          trackingUrl: null,
          carrier: order.carrier,
          service: order.service,
          estimatedDelivery: order.estimatedDelivery,
          shipmentStatus: order.shipmentStatus,
        },
        events: [],
        message: "Tracking information not yet available",
      });
    }

    // Fetch tracking data from ShipEngine
    const trackingData = await getOrderTracking(orderId);

    // Return tracking information
    return NextResponse.json(
      {
        order: {
          id: order.id,
          trackingCode: order.trackingCode,
          trackingUrl: order.trackingUrl,
          carrier: order.carrier,
          service: order.service,
          estimatedDelivery: order.estimatedDelivery,
          shipmentStatus: order.shipmentStatus,
        },
        events: trackingData.events || [],
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          // Cache for 5 minutes
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching tracking information:", error);

    // Return a friendly error message
    return NextResponse.json(
      {
        error: "Failed to fetch tracking information",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
