import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@buttergolf/db";
import Stripe from "stripe";

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
 * For Fully Embedded Connect integrations, this webhook stores requirements
 * data to enable the notification banner to function properly.
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
          console.log(`Account authorized: ${data.account}`);
          const account = await stripe.accounts.retrieve(data.account);
          await handleAccountUpdated(account);
        }
        break;
      }

      case "account.application.deauthorized": {
        const data = event.data.object as { account?: string };
        if (data.account) {
          console.log(`Account deauthorized: ${data.account}`);

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
        console.log(
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
        console.log(`Person ${person.id} updated for account ${person.account}`);

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
        console.log(
          `Payout ${payout.id} ${event.type.split(".")[1]}: ${payout.amount / 100} ${payout.currency.toUpperCase()}`
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
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
 * Handle account.updated events
 * Syncs the Connect account status to our database using V2 API
 */
async function handleAccountUpdated(account: Stripe.Account) {
  try {
    // Find user by Connect account ID
    const user = await prisma.user.findUnique({
      where: { stripeConnectId: account.id },
    });

    if (!user) {
      console.warn(`User not found for Stripe account: ${account.id}`);
      return;
    }

    // Fetch full account details from V2 API for accurate status
    const response = await fetch(
      `https://api.stripe.com/v2/core/accounts/${account.id}?include=configuration.merchant&include=requirements`,
      {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Stripe-Version": "2025-04-30.preview",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch V2 account details: ${response.status}`);
      // Fallback to V1 data from webhook event
      return handleV1AccountUpdate(user.id, account);
    }

    const v2Account = await response.json();

    // Determine account status from V2 API
    const currentlyDue = v2Account.requirements?.currently_due || [];
    const hasNoDue = currentlyDue.length === 0;
    const cardPaymentsActive =
      v2Account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
    const transfersActive =
      v2Account.configuration?.merchant?.capabilities?.transfers?.status === "active";

    let status = "pending";
    if (hasNoDue && cardPaymentsActive && transfersActive) {
      status = "active";
    } else if (hasNoDue) {
      status = "restricted"; // No requirements due but capabilities not fully active
    }

    // Extract requirements deadline if present
    let requirementsDeadline: Date | null = null;
    if (v2Account.requirements?.current_deadline) {
      requirementsDeadline = new Date(v2Account.requirements.current_deadline * 1000);
    }

    // Update user record with requirements data for notification banner
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeOnboardingComplete: hasNoDue,
        stripeAccountStatus: status,
        stripeRequirementsDue: currentlyDue.length > 0 ? currentlyDue : null,
        stripeRequirementsDeadline: requirementsDeadline,
      },
    });

    console.log(
      `Updated user ${user.id} Connect status: ${status}, requirements: ${currentlyDue.length} (V2 API)`
    );

    // If seller just became fully onboarded, process any pending transfers
    // Check capabilities directly rather than relying on derived status
    if (cardPaymentsActive && transfersActive) {
      await processPendingTransfersForSeller(user.id, account.id);
    }

    // Sync address from Stripe to database
    await syncAddressFromStripe(user.id, account);
  } catch (error) {
    console.error("Error updating user from webhook:", error);
    throw error;
  }
}

/**
 * Fallback handler using V1 account data from webhook
 */
async function handleV1AccountUpdate(userId: string, account: Stripe.Account) {
  let status = "pending";
  if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
    status = "active";
  } else if (account.details_submitted) {
    status = "restricted";
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeOnboardingComplete: account.details_submitted || false,
      stripeAccountStatus: status,
    },
  });

  console.log(`Updated user ${userId} Connect status: ${status} (V1 fallback)`);

  // Sync address from Stripe to database
  await syncAddressFromStripe(userId, account);
}

/**
 * Sync address from Stripe Connect account to database
 * Extracts individual.address from Stripe account and creates/updates our Address record
 */
async function syncAddressFromStripe(userId: string, account: Stripe.Account) {
  try {
    // Check if account has individual address data
    if (!account.individual?.address) {
      console.log(`No individual address found for Stripe account ${account.id}`);
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
      console.log(`Updated address for user ${userId} from Stripe Connect`);
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
      console.log(`Created address for user ${userId} from Stripe Connect`);
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
    // Use transaction to prevent race conditions:
    // Query + update atomically so concurrent webhook events don't double-process
    const pendingOrders = await prisma.$transaction(async (tx) => {
      // Find all orders pending seller onboarding for this seller
      const orders = await tx.order.findMany({
        where: {
          sellerId: userId,
          paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
        },
        include: {
          product: true,
          seller: true,
        },
      });

      // Mark them as being processed to prevent double-processing
      // This happens atomically within the transaction
      if (orders.length > 0) {
        await tx.order.updateMany({
          where: {
            id: { in: orders.map((o) => o.id) },
            paymentHoldStatus: "PENDING_SELLER_ONBOARDING", // Double-check status
          },
          data: {
            // Use a temporary status to indicate processing
            // We'll update to RELEASED after successful transfer
            stripePayoutStatus: "processing",
          },
        });
      }

      return orders;
    });

    if (pendingOrders.length === 0) {
      console.log(`No pending transfers for seller ${userId}`);
      return;
    }

    console.log(
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

        // Create transfer to seller's Stripe Connect account
        const transfer = await stripe.transfers.create({
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
        });

        // Update order status
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentHoldStatus: "RELEASED",
            paymentReleasedAt: new Date(),
            stripeTransferId: transfer.id,
            stripePayoutStatus: "completed",
          },
        });

        console.log(
          `Transfer ${transfer.id} created for order ${order.id}: £${transferAmountInPence / 100}`
        );

        // TODO: Send payment released email to seller
      } catch (transferError) {
        console.error(`Failed to process transfer for order ${order.id}:`, transferError);
        // Reset the order status so it can be retried
        await prisma.order.update({
          where: { id: order.id },
          data: {
            stripePayoutStatus: null,
          },
        });
        // Continue with other orders - don't let one failure stop the rest
      }
    }
  } catch (error) {
    console.error(`Error processing pending transfers for seller ${userId}:`, error);
    // Don't throw - we don't want this to break webhook processing
  }
}
