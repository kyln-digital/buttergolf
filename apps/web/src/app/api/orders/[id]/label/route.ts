import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { generateShippingLabel } from "@/lib/shipengine";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/orders/[id]/label
 * Generate a shipping label for an order
 * Only the seller can generate labels for their orders
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Get order and verify seller
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        fromAddress: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only seller can generate labels
    if (order.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Only the seller can generate shipping labels" },
        { status: 403 }
      );
    }

    // Check if label already exists
    if (order.labelUrl) {
      return NextResponse.json({
        message: "Label already generated",
        labelUrl: order.labelUrl,
        labelPngUrl: order.labelPngUrl,
        labelZplUrl: order.labelZplUrl,
        trackingCode: order.trackingCode,
        trackingUrl: order.trackingUrl,
      });
    }

    // Check seller has valid address
    if (order.fromAddress.street1 === "Address pending") {
      return NextResponse.json(
        { error: "Please update your shipping address before generating a label" },
        { status: 400 }
      );
    }

    // Generate the label
    const result = await generateShippingLabel({ orderId });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error generating label:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate label" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[id]/label
 * Get label information for an order
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

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        sellerId: true,
        buyerId: true,
        labelUrl: true,
        labelPngUrl: true,
        labelZplUrl: true,
        trackingCode: true,
        trackingUrl: true,
        carrier: true,
        service: true,
        labelGeneratedAt: true,
        estimatedDelivery: true,
        status: true,
        shipmentStatus: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only buyer or seller can view label info
    if (order.sellerId !== user.id && order.buyerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      hasLabel: !!order.labelUrl,
      labelUrl: order.labelUrl,
      labelPngUrl: order.labelPngUrl,
      labelZplUrl: order.labelZplUrl,
      trackingCode: order.trackingCode,
      trackingUrl: order.trackingUrl,
      carrier: order.carrier,
      service: order.service,
      labelGeneratedAt: order.labelGeneratedAt,
      estimatedDelivery: order.estimatedDelivery,
      status: order.status,
      shipmentStatus: order.shipmentStatus,
    });
  } catch (error) {
    console.error("Error fetching label info:", error);
    return NextResponse.json({ error: "Failed to fetch label information" }, { status: 500 });
  }
}
