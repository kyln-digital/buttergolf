import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { stripe } from "@/lib/stripe";
import { sendPaymentReleasedEmail } from "@/lib/email";

// Vercel Cron configuration
// Schedule: Run daily at 3:00 AM UTC
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/release-payments",
//     "schedule": "0 3 * * *"
//   }]
// }

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for processing

/**
 * GET /api/cron/release-payments
 *
 * Auto-release held payments after 14 days from delivery.
 *
 * This is part of the Vinted-style buyer protection flow:
 * 1. Payment is held when order is placed
 * 2. Buyer can manually confirm receipt to release payment
 * 3. If buyer doesn't confirm, payment auto-releases 14 days after delivery
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security (MANDATORY)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured - refusing to process payments");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized cron request - invalid or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("Starting auto-release payment cron job...");

  try {
    // Find orders eligible for auto-release:
    // - Payment status is HELD
    // - Auto-release date has passed
    // - Shipment status is DELIVERED (we only auto-release after confirmed delivery)
    const ordersToRelease = await prisma.order.findMany({
      where: {
        paymentHoldStatus: "HELD",
        autoReleaseAt: { lte: new Date() },
        shipmentStatus: "DELIVERED",
      },
      include: {
        seller: true,
        product: true,
      },
      // stripeChargeId and stripePaymentId are scalar fields on Order,
      // so they're included by default (no need to explicitly select them)
    });

    console.info(`Found ${ordersToRelease.length} orders eligible for auto-release`);

    if (ordersToRelease.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orders eligible for auto-release",
        processed: 0,
        results: [],
      });
    }

    const results: Array<{
      orderId: string;
      status: "success" | "failed";
      transferId?: string;
      error?: string;
    }> = [];

    // Process each order with optimistic locking to prevent duplicate transfers
    for (const order of ordersToRelease) {
      try {
        // STEP 1: Verify all preconditions BEFORE claiming the order
        // This prevents setting RELEASED status for orders that will fail processing

        // Verify seller has Stripe Connect account
        if (!order.seller.stripeConnectId) {
          console.error("Seller missing Stripe Connect ID:", {
            orderId: order.id,
            sellerId: order.sellerId,
          });
          results.push({
            orderId: order.id,
            status: "failed",
            error: "Seller Stripe Connect not configured",
          });
          continue;
        }

        // Calculate and verify transfer amount
        const transferAmountInPence = Math.round((order.stripeSellerPayout || 0) * 100);

        if (transferAmountInPence <= 0) {
          console.error("Invalid transfer amount:", {
            orderId: order.id,
            sellerPayout: order.stripeSellerPayout,
          });
          results.push({
            orderId: order.id,
            status: "failed",
            error: "Invalid payout amount",
          });
          continue;
        }

        // Verify no transfer has already been created (double-check)
        if (order.stripeTransferId) {
          console.warn("Order already has transfer ID:", {
            orderId: order.id,
            existingTransferId: order.stripeTransferId,
          });
          results.push({
            orderId: order.id,
            status: "failed",
            error: "Transfer already exists",
          });
          continue;
        }

        // Verify the charge is still intact - a refunded or disputed charge
        // must never auto-release to the seller (the buyer already has, or may
        // get, their money back). The refund/dispute webhooks normally take
        // the order out of HELD, but this guards against missed events.
        if (order.stripeChargeId) {
          const charge = await stripe.charges.retrieve(order.stripeChargeId);

          if (charge.refunded || (charge.amount_refunded || 0) > 0 || charge.disputed) {
            console.error("Skipping auto-release - charge refunded or disputed:", {
              orderId: order.id,
              chargeId: order.stripeChargeId,
              refunded: charge.refunded,
              amountRefunded: charge.amount_refunded,
              disputed: charge.disputed,
            });

            // Sync the hold status so the order stops matching this query
            if (charge.refunded || charge.disputed) {
              await prisma.order.updateMany({
                where: { id: order.id, paymentHoldStatus: "HELD" },
                data: { paymentHoldStatus: charge.refunded ? "REFUNDED" : "DISPUTED" },
              });
            }

            results.push({
              orderId: order.id,
              status: "failed",
              error: "Charge refunded or disputed - release blocked",
            });
            continue;
          }
        }

        // STEP 2: All preconditions verified - now use transaction to atomically:
        // 1. Claim the order (optimistic lock)
        // 2. Create the Stripe transfer
        // 3. Update with transfer details
        // If any step fails, the status remains HELD

        console.info("Creating auto-release transfer:", {
          orderId: order.id,
          sellerId: order.sellerId,
          amount: transferAmountInPence,
        });

        // Use optimistic locking - only proceed if still HELD and no transfer exists
        const lockedOrder = await prisma.order.updateMany({
          where: {
            id: order.id,
            paymentHoldStatus: "HELD", // Must still be HELD
            stripeTransferId: null, // Must not have existing transfer
          },
          data: {
            paymentHoldStatus: "RELEASED", // Claim it
          },
        });

        if (lockedOrder.count === 0) {
          // Another process already claimed this order or it's no longer eligible
          console.info("Order already being processed or released:", order.id);
          results.push({
            orderId: order.id,
            status: "failed",
            error: "Order already processed by another instance",
          });
          continue;
        }

        // STEP 3: Create the Stripe transfer (order is now locked as RELEASED)
        // Keep params deterministic so retries can safely use idempotency keys.
        const chargeId = order.stripeChargeId;

        let transfer;
        try {
          transfer = await stripe.transfers.create(
            {
              amount: transferAmountInPence,
              currency: "gbp",
              destination: order.seller.stripeConnectId,
              transfer_group: order.id,
              ...(chargeId ? { source_transaction: chargeId } : {}),
              metadata: {
                orderId: order.id,
                productId: order.productId,
                sellerId: order.sellerId,
                reason: "auto_release_14_days",
              },
            },
            {
              // Single key per order across every release path (confirm-receipt,
              // this cron, onboarding drain) so a double-release can never mint
              // two transfers for the same order.
              idempotencyKey: `release:${order.id}`,
            }
          );
        } catch (stripeError) {
          // Transfer failed - rollback status to HELD
          console.error("Stripe transfer failed, rolling back status:", {
            orderId: order.id,
            error: stripeError instanceof Error ? stripeError.message : "Unknown Stripe error",
          });

          await prisma.order.update({
            where: { id: order.id },
            data: { paymentHoldStatus: "HELD" },
          });

          results.push({
            orderId: order.id,
            status: "failed",
            error: stripeError instanceof Error ? stripeError.message : "Stripe transfer failed",
          });
          continue;
        }

        // STEP 4: Update order with transfer details
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentReleasedAt: new Date(),
            stripeTransferId: transfer.id,
            stripePayoutStatus: "completed",
          },
        });

        console.info("Auto-release transfer successful:", {
          orderId: order.id,
          transferId: transfer.id,
        });

        results.push({
          orderId: order.id,
          status: "success",
          transferId: transfer.id,
        });

        // Send email notification to seller about payment release
        try {
          await sendPaymentReleasedEmail({
            sellerEmail: order.seller.email,
            sellerName: order.seller.firstName || "Seller",
            orderId: order.id,
            productTitle: order.product.title,
            payoutAmount: order.stripeSellerPayout || 0,
            releaseReason: "auto_released",
          });
          console.info("Payment released email sent to seller:", order.seller.email);
        } catch (emailError) {
          console.error("Failed to send payment released email:", emailError);
          // Don't fail the release if email fails
        }
      } catch (orderError) {
        console.error("Error processing order:", {
          orderId: order.id,
          error: orderError instanceof Error ? orderError.message : "Unknown error",
        });

        // Rollback the status if transfer failed (we set RELEASED early for locking)
        try {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentHoldStatus: "HELD" },
          });
        } catch (rollbackError) {
          console.error("Failed to rollback order status:", rollbackError);
        }

        results.push({
          orderId: order.id,
          status: "failed",
          error: orderError instanceof Error ? orderError.message : "Unknown error",
        });
      }
    }

    // Second pass: drain orders the buyer already confirmed but which were
    // parked because the seller hadn't finished onboarding. The Connect webhook
    // normally releases these, but if that event is missed they would otherwise
    // be stuck forever - this is the reconciliation safety net.
    const pendingOnboarding = await prisma.order.findMany({
      where: {
        paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
        seller: { stripeOnboardingComplete: true, stripeConnectId: { not: null } },
      },
      include: { seller: true, product: true },
    });

    for (const order of pendingOnboarding) {
      try {
        const transferAmountInPence = Math.round((order.stripeSellerPayout || 0) * 100);
        if (!order.seller.stripeConnectId || transferAmountInPence <= 0 || order.stripeTransferId) {
          continue;
        }

        // Atomic claim: only the run that flips the status proceeds.
        const claimed = await prisma.order.updateMany({
          where: {
            id: order.id,
            paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
            stripeTransferId: null,
          },
          data: { paymentHoldStatus: "RELEASED" },
        });
        if (claimed.count === 0) continue;

        try {
          const transfer = await stripe.transfers.create(
            {
              amount: transferAmountInPence,
              currency: "gbp",
              destination: order.seller.stripeConnectId,
              transfer_group: order.id,
              ...(order.stripeChargeId ? { source_transaction: order.stripeChargeId } : {}),
              metadata: {
                orderId: order.id,
                productId: order.productId,
                sellerId: order.sellerId,
                reason: "onboarding_completed_reconciliation",
              },
            },
            { idempotencyKey: `release:${order.id}` }
          );

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentReleasedAt: new Date(),
              stripeTransferId: transfer.id,
              stripePayoutStatus: "completed",
            },
          });

          results.push({ orderId: order.id, status: "success", transferId: transfer.id });
        } catch (stripeError) {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentHoldStatus: "PENDING_SELLER_ONBOARDING" },
          });
          results.push({
            orderId: order.id,
            status: "failed",
            error: stripeError instanceof Error ? stripeError.message : "Stripe transfer failed",
          });
        }
      } catch (orderError) {
        console.error("Error draining pending-onboarding order:", {
          orderId: order.id,
          orderError,
        });
        results.push({
          orderId: order.id,
          status: "failed",
          error: orderError instanceof Error ? orderError.message : "Unknown error",
        });
      }
    }

    // Reconciliation alert: orders claimed RELEASED but with no transfer recorded
    // indicate a crash between claim and transfer - they need manual attention.
    const orphanedReleases = await prisma.order.count({
      where: { paymentHoldStatus: "RELEASED", stripeTransferId: null },
    });
    if (orphanedReleases > 0) {
      console.error("RECONCILIATION: orders marked RELEASED with no transfer:", {
        count: orphanedReleases,
      });
    }

    const totalProcessed = ordersToRelease.length + pendingOnboarding.length;
    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    console.info("Auto-release cron job completed:", {
      total: totalProcessed,
      success: successCount,
      failed: failedCount,
      orphanedReleases,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} orders`,
      processed: totalProcessed,
      successCount,
      failedCount,
      orphanedReleases,
      results,
    });
  } catch (error) {
    console.error("Auto-release cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
