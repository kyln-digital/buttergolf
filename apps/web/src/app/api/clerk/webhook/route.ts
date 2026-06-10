import { headers } from "next/headers";
import { Webhook } from "svix";
import { prisma } from "@buttergolf/db";
import { NextResponse } from "next/server";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2025-10-29.clover",
  });

  return stripeClient;
}

type WebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
};

// Route Handler for Clerk webhooks
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing CLERK_WEBHOOK_SECRET" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Svix verify failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = evt.type as string;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const data = evt.data;
      const clerkId: string = data.id;
      const email: string | undefined = data.email_addresses?.[0]?.email_address;
      const firstName = data.first_name || "";
      const lastName = data.last_name || "";
      const imageUrl: string | undefined = data.image_url;

      if (!email) {
        // Skip if no email provided
        return NextResponse.json({ ok: true });
      }

      // Use email prefix as fallback if no name provided
      const fallbackName = email.split("@")[0];

      await prisma.user.upsert({
        where: { clerkId },
        update: {
          email,
          firstName: firstName || fallbackName,
          lastName: lastName || "",
          imageUrl,
        },
        create: {
          clerkId,
          email,
          firstName: firstName || fallbackName,
          lastName: lastName || "",
          imageUrl,
        },
      });
    } else if (eventType === "user.deleted") {
      // Soft delete: mark user as deleted and anonymize PII
      const clerkId: string = evt.data.id;
      console.info(`[Clerk Webhook] Processing user.deleted for clerkId: ${clerkId}`);

      // First, find the user to get their ID and Stripe account
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, stripeConnectId: true },
      });

      console.info(`[Clerk Webhook] Found user:`, user);

      if (user) {
        // Remove listings that have no orders. Products tied to orders cannot
        // be hard-deleted (orders are financial records and the FK is Restrict),
        // and deleting them here would throw and abort the whole deletion. Those
        // are instead hidden from public views via the seller `isDeleted` filter.
        const deletedProducts = await prisma.product.deleteMany({
          where: { userId: user.id, orders: { none: {} } },
        });
        console.info(`[Clerk Webhook] Deleted ${deletedProducts.count} order-less products`);

        // Delete Stripe Connect account if exists
        if (user.stripeConnectId) {
          console.info(
            `[Clerk Webhook] Attempting to delete Stripe account: ${user.stripeConnectId}`
          );
          try {
            const stripe = getStripeClient();
            if (!stripe) {
              console.warn(
                "[Clerk Webhook] STRIPE_SECRET_KEY is not set; skipping Stripe Connect account deletion"
              );
            } else {
              await stripe.accounts.del(user.stripeConnectId);
            }
            console.info(
              `[Clerk Webhook] Successfully deleted Stripe Connect account ${user.stripeConnectId}`
            );
          } catch (stripeError) {
            // Log but don't fail - account may already be deleted or invalid
            console.error(
              `[Clerk Webhook] Failed to delete Stripe Connect account ${user.stripeConnectId}:`,
              stripeError
            );
          }
        } else {
          console.info(`[Clerk Webhook] No stripeConnectId found for user`);
        }
      } else {
        console.info(`[Clerk Webhook] User not found in database for clerkId: ${clerkId}`);
      }

      // Use updateMany to avoid errors if user doesn't exist in database
      // (e.g., if deleted from Clerk before user.created webhook fired)
      await prisma.user.updateMany({
        where: { clerkId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          // Anonymize PII while preserving referential integrity
          email: `deleted_${clerkId}@deleted.local`,
          firstName: "Deleted",
          lastName: "User",
          imageUrl: null,
          stripeConnectId: null, // Clear the Stripe account reference
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Clerk webhook error", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
