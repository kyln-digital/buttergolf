import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { generateShippingLabelRecordingFailure } from "@/lib/shipengine";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * Which label failures are the caller's to fix, and which are ours.
 *
 * The seller can act on an incomplete address; they can do nothing about
 * missing carrier config or an unreachable ShipEngine, and those should read
 * as server faults in logs and monitoring.
 */
const LABEL_ERROR_STATUS: Record<string, number> = {
  SELLER_ADDRESS_INVALID: 400,
  NO_RATES_AVAILABLE: 400,
  ORDER_NOT_FOUND: 404,
  ALREADY_GENERATED: 409,
  NOT_CONFIGURED: 503,
  NO_CARRIERS_CONFIGURED: 503,
  NO_RATE_MEETS_SERVICE: 503,
  PURCHASE_FAILED: 502,
};

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

    // Generate the label. The recording wrapper persists any failure on the
    // order, so a seller who retries later still sees why the last attempt
    // failed rather than an empty action column.
    const attempt = await generateShippingLabelRecordingFailure(orderId);

    if (attempt.status === "failed") {
      return NextResponse.json(
        { error: attempt.message, code: attempt.code },
        { status: LABEL_ERROR_STATUS[attempt.code] ?? 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...attempt.label,
    });
  } catch (error) {
    console.error("Error generating label:", error);
    return NextResponse.json({ error: "Failed to generate label" }, { status: 500 });
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
