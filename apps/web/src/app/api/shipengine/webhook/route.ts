import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma, Prisma, ShipmentStatus, OrderStatus } from "@buttergolf/db";
import crypto from "crypto";
import {
  sendLabelGeneratedEmail,
  sendInTransitEmail,
  sendOutForDeliveryEmail,
  sendDeliveredEmail,
} from "@/lib/email";

// ShipEngine webhook events we care about
type ShipEngineEvent = "track" | "shipment.created" | "label.created" | "label.voided";

interface ShipEngineTrackingWebhookPayload {
  resource_url: string;
  resource_type: "API_TRACK" | "LABEL" | "SHIPMENT";
  data: {
    tracking_number: string;
    carrier_status_code: string;
    status_code: string;
    status_description: string;
    carrier_code: string;
    carrier_detail_code?: string;
    events: Array<{
      occurred_at: string;
      carrier_occurred_at: string;
      description: string;
      city_locality: string;
      state_province: string;
      postal_code: string;
      country_code: string;
      company_name?: string;
      signer?: string;
      event_code?: string;
    }>;
    estimated_delivery_date?: string;
    actual_delivery_date?: string;
    ship_date?: string;
  };
}

// Map ShipEngine status to our ShipmentStatus enum
function mapShipEngineStatus(statusCode: string): ShipmentStatus {
  const status = statusCode.toUpperCase();

  switch (status) {
    case "UN":
    case "AC":
    case "PU":
      return "PRE_TRANSIT";
    case "IT":
    case "AT":
      return "IN_TRANSIT";
    case "DE":
      return "DELIVERED";
    case "EX":
    case "CA":
      return "FAILED";
    case "NY":
      return "PENDING";
    default:
      return "IN_TRANSIT";
  }
}

// Map shipment status to order status
function mapToOrderStatus(shipmentStatus: ShipmentStatus): OrderStatus {
  switch (shipmentStatus) {
    case "DELIVERED":
      return "DELIVERED";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "PRE_TRANSIT":
      return "SHIPPED";
    case "FAILED":
    case "RETURNED":
    case "CANCELLED":
      return "LABEL_GENERATED"; // Keep at label generated until resolved
    default:
      return "LABEL_GENERATED";
  }
}

// Verify ShipEngine webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const computedSignature = hmac.digest("base64");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
  } catch (error) {
    console.error("Error verifying ShipEngine webhook signature:", error);
    return false;
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.SHIPENGINE_WEBHOOK_SECRET;

  try {
    const body = await req.text();
    const headerPayload = await headers();

    // ShipEngine sends signature in X-ShipEngine-Signature header
    const signature = headerPayload.get("x-shipengine-signature");

    // Verify signature if webhook secret is configured
    if (WEBHOOK_SECRET && signature) {
      const isValid = verifyWebhookSignature(body, signature, WEBHOOK_SECRET);
      if (!isValid) {
        console.error("ShipEngine webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (WEBHOOK_SECRET && !signature) {
      console.error("Missing ShipEngine webhook signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const payload: ShipEngineTrackingWebhookPayload = JSON.parse(body);

    console.log("ShipEngine webhook event received:", {
      resourceType: payload.resource_type,
      trackingNumber: payload.data?.tracking_number,
      status: payload.data?.status_code,
    });

    // Handle tracking events
    if (payload.resource_type === "API_TRACK" && payload.data) {
      const trackingData = payload.data;
      const trackingCode = trackingData.tracking_number;

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

      // Map ShipEngine status to our enum
      const shipmentStatus = mapShipEngineStatus(trackingData.status_code);
      const orderStatus = mapToOrderStatus(shipmentStatus);

      // Prepare update data
      const updateData: Prisma.OrderUpdateInput = {
        shipmentStatus,
        status: orderStatus,
        updatedAt: new Date(),
      };

      // Update estimated delivery if provided
      if (trackingData.estimated_delivery_date) {
        updateData.estimatedDelivery = new Date(trackingData.estimated_delivery_date);
      }

      // Update delivered timestamp if delivered
      if (shipmentStatus === "DELIVERED") {
        updateData.deliveredAt = trackingData.actual_delivery_date
          ? new Date(trackingData.actual_delivery_date)
          : new Date();
      }

      // Update shipped timestamp if in transit for the first time
      if (
        (shipmentStatus === "IN_TRANSIT" || shipmentStatus === "PRE_TRANSIT") &&
        !order.shippedAt
      ) {
        updateData.shippedAt = trackingData.ship_date
          ? new Date(trackingData.ship_date)
          : new Date();
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

      // Send email notifications based on status change
      try {
        // Fetch related data for emails
        const buyer = await prisma.user.findUnique({
          where: { id: order.buyerId },
        });
        const product = await prisma.product.findUnique({
          where: { id: order.productId },
          select: { title: true },
        });

        if (!buyer || !product) {
          console.warn("Could not send email: missing buyer or product data");
        } else {
          const buyerName =
            `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim() || buyer.email;

          // PRE_TRANSIT: Label generated (only if this is first time)
          if (shipmentStatus === "PRE_TRANSIT" && !order.labelGeneratedAt) {
            await sendLabelGeneratedEmail({
              buyerEmail: buyer.email,
              buyerName,
              orderId: order.id,
              productTitle: product.title,
              estimatedDelivery: trackingData.estimated_delivery_date,
              carrier: order.carrier,
            });
            console.log("Sent label generated email to buyer");
          }

          // IN_TRANSIT: Package picked up and moving
          else if (shipmentStatus === "IN_TRANSIT") {
            const latestEvent = trackingData.events?.[0];
            const currentLocation = latestEvent
              ? `${latestEvent.city_locality}, ${latestEvent.state_province}`
              : undefined;

            await sendInTransitEmail({
              buyerEmail: buyer.email,
              buyerName,
              orderId: order.id,
              productTitle: product.title,
              trackingCode: order.trackingCode,
              trackingUrl: order.trackingUrl,
              carrier: order.carrier,
              currentLocation,
              estimatedDelivery: trackingData.estimated_delivery_date,
            });
            console.log("Sent in transit email to buyer");
          }

          // OUT_FOR_DELIVERY: Package out for delivery today
          else if (shipmentStatus === "OUT_FOR_DELIVERY") {
            await sendOutForDeliveryEmail({
              buyerEmail: buyer.email,
              buyerName,
              orderId: order.id,
              productTitle: product.title,
              trackingCode: order.trackingCode,
              trackingUrl: order.trackingUrl,
            });
            console.log("Sent out for delivery email to buyer");
          }

          // DELIVERED: Package delivered (send to both buyer and seller)
          else if (shipmentStatus === "DELIVERED") {
            // Send to buyer
            await sendDeliveredEmail({
              email: buyer.email,
              name: buyerName,
              orderId: order.id,
              productTitle: product.title,
              isBuyer: true,
            });
            console.log("Sent delivered email to buyer");

            // Send to seller
            const seller = await prisma.user.findUnique({
              where: { id: order.sellerId },
            });
            if (seller) {
              const sellerName =
                `${seller.firstName || ""} ${seller.lastName || ""}`.trim() || seller.email;
              await sendDeliveredEmail({
                email: seller.email,
                name: sellerName,
                orderId: order.id,
                productTitle: product.title,
                isBuyer: false,
              });
              console.log("Sent delivered email to seller");
            }
          }
        }
      } catch (emailError) {
        // Don't fail the webhook if email fails
        console.error("Error sending email notification:", emailError);
      }

      return NextResponse.json({
        received: true,
        orderId: order.id,
        status: shipmentStatus,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing ShipEngine webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
