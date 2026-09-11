import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import Stripe from "stripe";
import { deriveConnectStatus, syncConnectStatus } from "@/lib/stripe-connect";

/**
 * POST /api/stripe/connect/webhook
 * Handles Stripe Connect webhooks for account updates
 *
 * Events handled:
 * - account.updated: Syncs onboarding status, requirements, and account details
 * - account.application.authorized: User granted permission to platform
 * - account.application.deauthorized: User revoked permission
 * - capability.updated: Track capability status changes
 * - person.updated: Track person verification status
 *
 * Status is derived with the same `deriveConnectStatus` the status routes use,
 * so webhook- and poll-driven updates agree; the stored requirements feed our
 * own payout banner in the seller dashboard.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    // Use dedicated Connect webhook secret, fallback to main secret for backwards compatibility
    const webhookSecret =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_CONNECT_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case "account.application.authorized": {
        const data = event.data.object as { account?: string };
        if (data.account) {
          console.info(`Account authorized: ${data.account}`);
          const account = await stripe.accounts.retrieve(data.account);
          await handleAccountUpdated(account);
        }
        break;
      }

      case "account.application.deauthorized": {
        const data = event.data.object as { account?: string };
        if (data.account) {
          console.info(`Account deauthorized: ${data.account}`);

          // Find user and clear their Connect account
          const user = await prisma.user.findUnique({
            where: { stripeConnectId: data.account },
          });

          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                stripeConnectId: null,
                stripeOnboardingComplete: false,
                stripeAccountStatus: "deauthorized",
                stripeRequirementsDue: null,
                stripeRequirementsDeadline: null,
              },
            });
          }
        }
        break;
      }

      case "capability.updated": {
        // Handle capability status changes
        const capability = event.data.object as Stripe.Capability;
        console.info(
          `Capability ${capability.id} updated: ${capability.status} for account ${capability.account}`
        );

        // Refresh account status when capabilities change
        if (typeof capability.account === "string") {
          const account = await stripe.accounts.retrieve(capability.account);
          await handleAccountUpdated(account);
        }
        break;
      }

      case "person.updated": {
        // Handle person verification status changes
        const person = event.data.object as Stripe.Person;
        console.info(`Person ${person.id} updated for account ${person.account}`);

        // Refresh account status when person verification changes
        if (typeof person.account === "string") {
          const account = await stripe.accounts.retrieve(person.account);
          await handleAccountUpdated(account);
        }
        break;
      }

      case "payout.created":
      case "payout.paid":
      case "payout.failed": {
        // Log payout events for monitoring
        const payout = event.data.object as Stripe.Payout;
        console.info(
          `Payout ${payout.id} ${event.type.split(".")[1]}: ${payout.amount / 100} ${payout.currency.toUpperCase()}`
        );
        break;
      }

      default:
        console.info(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Sync a connected account's state to our database.
 *
 * The derivation is shared with the status routes (`deriveConnectStatus`), so
 * webhook-driven and poll-driven updates can never disagree about whether a
 * seller can be paid. `stripeOnboardingComplete` means payouts enabled,
 * transfers capability active and nothing currently due.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const user = await prisma.user.findUnique({
    where: { stripeConnectId: account.id },
    select: { id: true },
  });

  if (!user) {
    console.warn(`User not found for Stripe account: ${account.id}`);
    return;
  }

  const summary = deriveConnectStatus(account);
  await syncConnectStatus(user.id, summary);

  console.info(
    `Updated user ${user.id} Connect status: ${summary.status}, complete=${summary.isComplete}, requirements: ${summary.requirements.currentlyDue.length}`
  );

  // Newly payable seller: drain anything that was waiting on their setup.
  if (summary.isComplete) {
    await processPendingTransfersForSeller(user.id, account.id);
  }

  await syncAddressFromStripe(user.id, account);
}

/**
 * Sync address from Stripe Connect account to database
 * Extracts individual.address from Stripe account and creates/updates our Address record
 */
async function syncAddressFromStripe(userId: string, account: Stripe.Account) {
  try {
    // Check if account has individual address data
    if (!account.individual?.address) {
      console.info(`No individual address found for Stripe account ${account.id}`);
      return;
    }

    const stripeAddress = account.individual.address;

    // Validate that address has required fields
    if (!stripeAddress.line1 || !stripeAddress.city || !stripeAddress.postal_code) {
      console.warn(`Incomplete address data for account ${account.id}:`, stripeAddress);
      return;
    }

    // Check if user already has an address in our database
    const existingAddress = await prisma.address.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    if (existingAddress) {
      // Update existing address
      await prisma.address.update({
        where: { id: existingAddress.id },
        data: {
          street1: stripeAddress.line1,
          street2: stripeAddress.line2 || "",
          city: stripeAddress.city,
          state: stripeAddress.state || "",
          zip: stripeAddress.postal_code,
          country: stripeAddress.country || "GB",
        },
      });
      console.info(`Updated address for user ${userId} from Stripe Connect`);
    } else {
      // Create new address from Stripe data
      const name =
        `${account.individual.first_name || ""} ${account.individual.last_name || ""}`.trim() ||
        "Seller";

      await prisma.address.create({
        data: {
          userId,
          name,
          street1: stripeAddress.line1,
          street2: stripeAddress.line2 || "",
          city: stripeAddress.city,
          state: stripeAddress.state || "",
          zip: stripeAddress.postal_code,
          country: stripeAddress.country || "GB",
          isDefault: true,
        },
      });
      console.info(`Created address for user ${userId} from Stripe Connect`);
    }
  } catch (error) {
    console.error(`Error syncing address for user ${userId}:`, error);
    // Don't throw - we don't want address sync failures to break webhook processing
  }
}

/**
 * Process pending transfers for a seller who just completed onboarding
 *
 * When a seller completes Stripe Connect setup, check if they have any orders
 * in PENDING_SELLER_ONBOARDING status and execute those transfers.
 */
async function processPendingTransfersForSeller(userId: string, stripeConnectId: string) {
  try {
    // Onboarding completion fires several Stripe events near-simultaneously
    // (account.updated, capability.updated x2, person.updated), each of which
    // reaches this function. The per-order atomic claim below (updateMany on
    // paymentHoldStatus) is what prevents duplicate transfers - this initial
    // query is just candidate selection.
    const pendingOrders = await prisma.order.findMany({
      where: {
        sellerId: userId,
        paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
      },
      include: {
        product: true,
        seller: true,
      },
    });

    if (pendingOrders.length === 0) {
      console.info(`No pending transfers for seller ${userId}`);
      return;
    }

    console.info(
      `Processing ${pendingOrders.length} pending transfer(s) for seller ${userId} (${stripeConnectId})`
    );

    for (const order of pendingOrders) {
      try {
        // Skip if already has a transfer (shouldn't happen, but safety check)
        if (order.stripeTransferId) {
          console.warn(
            `Order ${order.id} already has transfer ${order.stripeTransferId}, skipping`
          );
          continue;
        }

        // Validate charge before transfer (same pattern as confirm-receipt)
        if (!order.stripePaymentId) {
          console.error(`Order ${order.id} missing payment intent ID`);
          continue;
        }

        // Retrieve the payment intent to get the charge ID
        const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentId);
        const chargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id;

        if (!chargeId) {
          console.error(`Order ${order.id} has no charge associated with payment intent`);
          continue;
        }

        // Validate the charge is captured and not refunded
        const charge = await stripe.charges.retrieve(chargeId);
        if (!charge.captured) {
          console.error(`Order ${order.id} charge ${chargeId} is not captured`);
          continue;
        }
        if (charge.refunded) {
          console.error(`Order ${order.id} charge ${chargeId} has been refunded`);
          continue;
        }

        // Calculate transfer amount
        const transferAmountInPence = Math.round((order.stripeSellerPayout || 0) * 100);
        if (transferAmountInPence <= 0) {
          console.error(`Invalid transfer amount for order ${order.id}:`, order.stripeSellerPayout);
          continue;
        }

        // Atomically claim the order before transferring. Concurrent webhook
        // deliveries all reach this point; only the one that flips the status
        // proceeds. Rolled back to PENDING_SELLER_ONBOARDING on failure.
        const claimed = await prisma.order.updateMany({
          where: {
            id: order.id,
            paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
            stripeTransferId: null,
          },
          data: { paymentHoldStatus: "RELEASED", stripePayoutStatus: "processing" },
        });

        if (claimed.count === 0) {
          console.info(`Order ${order.id} already claimed by a concurrent event, skipping`);
          continue;
        }

        // Create transfer to seller's Stripe Connect account
        let transfer;
        try {
          transfer = await stripe.transfers.create(
            {
              amount: transferAmountInPence,
              currency: "gbp",
              destination: stripeConnectId,
              transfer_group: order.id,
              source_transaction: chargeId, // Link to the original charge
              metadata: {
                orderId: order.id,
                productId: order.productId,
                sellerId: order.sellerId,
                reason: "seller_completed_onboarding",
              },
            },
            {
              // Single key per order across every release path (confirm-receipt,
              // auto-release cron, this drain) so a double-release can never
              // mint two transfers for the same order.
              idempotencyKey: `release:${order.id}`,
            }
          );
        } catch (stripeError) {
          // Release the claim so a later account event can retry the transfer
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentHoldStatus: "PENDING_SELLER_ONBOARDING", stripePayoutStatus: null },
          });
          throw stripeError;
        }

        // Update order with transfer details
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentReleasedAt: new Date(),
            stripeTransferId: transfer.id,
            stripePayoutStatus: "completed",
          },
        });

        console.info(
          `Transfer ${transfer.id} created for order ${order.id}: £${transferAmountInPence / 100}`
        );

        // TODO: Send payment released email to seller
      } catch (transferError) {
        // Stripe failures already rolled the claim back above. Anything that
        // fails after a successful transfer (e.g. the final DB update) must
        // NOT roll back the claim - the money has moved. Surface it loudly
        // for reconciliation instead.
        console.error(`Failed to process transfer for order ${order.id}:`, transferError);
        // Continue with other orders - don't let one failure stop the rest
      }
    }
  } catch (error) {
    console.error(`Error processing pending transfers for seller ${userId}:`, error);
    // Don't throw - we don't want this to break webhook processing
  }
}
