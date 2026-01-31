import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma, Prisma, ShipmentStatus, OrderStatus } from "@buttergolf/db";
import crypto from "crypto";

// EasyPost webhook events we care about
type EasyPostEvent =
  | "tracker.created"
  | "tracker.updated"
  | "shipment.created"
  | "shipment.updated";

interface EasyPostWebhookPayload {
  id: string;
  object: string;
  mode: string;
  description: string;
  result: {
    id: string;
    object: string;
    mode: string;
    tracking_code: string;
    status: string;
    status_detail: string;
    carrier: string;
    tracking_details: Array<{
      status: string;
      status_detail: string;
      datetime: string;
      message: string;
      tracking_location: {
        city: string;
        state: string;
        country: string;
        zip: string;
      };
    }>;
    est_delivery_date?: string;
    shipment_id?: string;
  };
}

// Map EasyPost status to our ShipmentStatus enum
function mapEasyPostStatus(status: string): string {
  const statusLower = status.toLowerCase();

  if (statusLower === "pre_transit") return "PRE_TRANSIT";
  if (statusLower === "in_transit") return "IN_TRANSIT";
  if (statusLower === "out_for_delivery") return "OUT_FOR_DELIVERY";
  if (statusLower === "delivered") return "DELIVERED";
  if (statusLower === "returned") return "RETURNED";
  if (statusLower === "failure") return "FAILED";
  if (statusLower === "cancelled") return "CANCELLED";

  // Default to IN_TRANSIT for unknown statuses that aren't errors
  if (statusLower === "available_for_pickup" || statusLower === "return_to_sender") {
    return "IN_TRANSIT";
  }

  return "PENDING";
}

// Map shipment status to order status
function mapToOrderStatus(shipmentStatus: string): string {
  if (shipmentStatus === "DELIVERED") return "DELIVERED";
  if (shipmentStatus === "PRE_TRANSIT" || shipmentStatus === "IN_TRANSIT") return "SHIPPED";
  return "LABEL_GENERATED";
}

// Verify EasyPost webhook signature
// EasyPost uses HMAC-SHA256, typically without prefixes
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const computedSignature = hmac.digest("hex");

    // Handle potential format variations
    // Some webhooks send "sha256=<hash>", others just "<hash>"
    const signatureToVerify = signature.startsWith("sha256=") ? signature.substring(7) : signature;

    return crypto.timingSafeEqual(Buffer.from(signatureToVerify), Buffer.from(computedSignature));
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.EASYPOST_WEBHOOK_SECRET;

  try {
    const body = await req.text();
    const headerPayload = await headers();

    // EasyPost sends signature in X-EasyPost-Webhook-Signature header
    const signature = headerPayload.get("x-easypost-webhook-signature");

    // Verify signature if webhook secret is configured
    if (WEBHOOK_SECRET && signature) {
      const isValid = verifyWebhookSignature(body, signature, WEBHOOK_SECRET);
      if (!isValid) {
        console.error("EasyPost webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (WEBHOOK_SECRET && !signature) {
      console.error("Missing EasyPost webhook signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const payload: EasyPostWebhookPayload = JSON.parse(body);

    console.log("EasyPost webhook event received:", {
      id: payload.id,
      description: payload.description,
      trackingCode: payload.result?.tracking_code,
      status: payload.result?.status,
    });

    const event = payload.description as EasyPostEvent;

    // Handle tracker events
    if (event === "tracker.created" || event === "tracker.updated") {
      const tracker = payload.result;
      const trackingCode = tracker.tracking_code;

      if (!trackingCode) {
        console.error("Missing tracking code in webhook payload");
        return NextResponse.json({ error: "Missing tracking code" }, { status: 400 });
      }

      // Find order by tracking code
      const order = await prisma.order.findFirst({
        where: { trackingCode },
      });

      if (!order) {
        console.warn("Order not found for tracking code:", trackingCode);
        // Return success to avoid webhook retries
        return NextResponse.json({ received: true });
      }

      // Map EasyPost status to our enum
      const shipmentStatus = mapEasyPostStatus(tracker.status) as ShipmentStatus;
      const orderStatus = mapToOrderStatus(shipmentStatus) as OrderStatus;

      // Prepare update data
      const updateData: Prisma.OrderUpdateInput = {
        shipmentStatus,
        status: orderStatus,
        updatedAt: new Date(),
      };

      // Update estimated delivery if provided
      if (tracker.est_delivery_date) {
        updateData.estimatedDelivery = new Date(tracker.est_delivery_date);
      }

      // Update delivered timestamp if delivered
      if (shipmentStatus === "DELIVERED") {
        updateData.deliveredAt = new Date();

        // Find the latest tracking detail with delivered status
        const deliveredDetail = tracker.tracking_details?.find(
          (detail) => detail.status.toLowerCase() === "delivered"
        );
        if (deliveredDetail?.datetime) {
          updateData.deliveredAt = new Date(deliveredDetail.datetime);
        }
      }

      // Update shipped timestamp if in transit for the first time
      if (shipmentStatus === "IN_TRANSIT" && !order.shippedAt) {
        updateData.shippedAt = new Date();

        // Find the earliest in_transit tracking detail
        const inTransitDetail = tracker.tracking_details
          ?.filter((detail) => detail.status.toLowerCase() === "in_transit")
          ?.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0];

        if (inTransitDetail?.datetime) {
          updateData.shippedAt = new Date(inTransitDetail.datetime);
        }
      }

      // Update order
      await prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });

      console.log("Order updated:", {
        orderId: order.id,
        trackingCode,
        shipmentStatus,
        orderStatus,
      });

      // TODO: Send notification to buyer/seller about status update
      // - Buyer: Package is in transit / delivered
      // - Seller: Package was picked up

      return NextResponse.json({
        received: true,
        orderId: order.id,
        status: shipmentStatus,
      });
    }

    // Handle shipment events if needed
    if (event === "shipment.created" || event === "shipment.updated") {
      // Currently not needed, but can be implemented for additional tracking
      console.log("Shipment event received (not processed):", event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing EasyPost webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
