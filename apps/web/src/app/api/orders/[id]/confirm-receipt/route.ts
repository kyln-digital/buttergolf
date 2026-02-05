import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { stripe } from "@/lib/stripe";
import { sendPaymentReleasedEmail } from "@/lib/email";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * POST /api/orders/[id]/confirm-receipt
 *
 * Buyer confirms they've received the item and are satisfied.
 * This releases the held payment to the seller.
 *
 * Vinted-style flow:
 * 1. Buyer receives item
 * 2. Buyer clicks "Confirm Receipt"
 * 3. Platform transfers funds to seller's Stripe Connect account
 * 4. Order status updated to RELEASED
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkUserId = await getUserIdFromRequest(request);

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Get buyer from Clerk ID
    const buyer = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!buyer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the order with seller details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: true,
        product: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify buyer owns this order
    if (order.buyerId !== buyer.id) {
      return NextResponse.json(
        { error: "You can only confirm receipt for your own orders" },
        { status: 403 }
      );
    }

    // Verify order is in HELD status
    if (order.paymentHoldStatus !== "HELD") {
      const statusMessages: Record<string, string> = {
        RELEASED: "Payment has already been released to the seller",
        DISPUTED: "This order is currently under dispute",
        REFUNDED: "This order has been refunded",
      };

      return NextResponse.json(
        {
          error:
            statusMessages[order.paymentHoldStatus] ||
            "Order is not in a valid state for confirmation",
        },
        { status: 400 }
      );
    }

    // Prevent duplicate transfers - verify no transfer has already been created
    if (order.stripeTransferId) {
      console.warn("Duplicate confirm-receipt attempt - transfer already exists:", {
        orderId,
        existingTransferId: order.stripeTransferId,
      });
      return NextResponse.json(
        { error: "Payment has already been released to the seller" },
        { status: 400 }
      );
    }

    // Calculate transfer amount (seller receives 100% of product + shipping)
    const transferAmountInPence = Math.round((order.stripeSellerPayout || 0) * 100);

    if (transferAmountInPence <= 0) {
      console.error("Invalid transfer amount:", {
        orderId,
        sellerPayout: order.stripeSellerPayout,
      });
      return NextResponse.json({ error: "Invalid payout amount" }, { status: 500 });
    }

    // Verify charge ID exists (required for transfer)
    if (!order.stripeChargeId) {
      console.error("Order missing charge ID:", { orderId });
      return NextResponse.json(
        { error: "Order payment details incomplete. Please contact support." },
        { status: 500 }
      );
    }

    // Verify the charge hasn't been refunded before proceeding
    try {
      const charge = await stripe.charges.retrieve(order.stripeChargeId);
      if (charge.refunded || (charge.amount_refunded && charge.amount_refunded > 0)) {
        console.error("Cannot transfer - charge has been refunded:", {
          orderId,
          chargeId: order.stripeChargeId,
          refunded: charge.refunded,
          amountRefunded: charge.amount_refunded,
        });
        return NextResponse.json(
          { error: "This order has been refunded and cannot be confirmed" },
          { status: 400 }
        );
      }
    } catch (chargeError) {
      console.error("Failed to verify charge status:", chargeError);
      return NextResponse.json(
        { error: "Unable to verify payment status. Please try again." },
        { status: 500 }
      );
    }

    // Check if seller has completed Stripe Connect onboarding
    // Vinted-style: If not onboarded, hold funds until seller completes setup
    const sellerIsOnboarded = order.seller.stripeConnectId && order.seller.stripeOnboardingComplete;

    if (!sellerIsOnboarded) {
      // Seller hasn't completed onboarding - mark as pending, funds stay on platform
      console.log("Seller not yet onboarded - marking order as PENDING_SELLER_ONBOARDING:", {
        orderId,
        sellerId: order.sellerId,
        hasConnectId: !!order.seller.stripeConnectId,
        onboardingComplete: order.seller.stripeOnboardingComplete,
      });

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
          buyerConfirmedAt: new Date(),
        },
      });

      console.log("Order updated to PENDING_SELLER_ONBOARDING:", {
        orderId: updatedOrder.id,
        buyerConfirmedAt: updatedOrder.buyerConfirmedAt,
      });

      // TODO: Send email to seller prompting them to complete onboarding
      // to receive their funds

      return NextResponse.json({
        success: true,
        orderId: order.id,
        paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
        message:
          "Receipt confirmed! Funds will be released to seller once they complete account setup.",
      });
    }

    // Seller is onboarded - proceed with transfer
    console.log("Creating transfer to seller:", {
      orderId,
      sellerId: order.sellerId,
      sellerConnectId: order.seller.stripeConnectId,
      amount: transferAmountInPence,
    });

    // Create transfer to seller's Stripe Connect account
    const transfer = await stripe.transfers.create({
      amount: transferAmountInPence,
      currency: "gbp",
      destination: order.seller.stripeConnectId!,
      transfer_group: order.id,
      metadata: {
        orderId: order.id,
        productId: order.productId,
        buyerId: buyer.id,
        sellerId: order.sellerId,
        reason: "buyer_confirmed_receipt",
      },
    });

    console.log("Transfer created successfully:", {
      transferId: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
    });

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentHoldStatus: "RELEASED",
        paymentReleasedAt: new Date(),
        buyerConfirmedAt: new Date(),
        stripeTransferId: transfer.id,
        stripePayoutStatus: "completed",
      },
    });

    console.log("Order updated to RELEASED:", {
      orderId: updatedOrder.id,
      paymentReleasedAt: updatedOrder.paymentReleasedAt,
    });

    // Send confirmation email to seller
    try {
      await sendPaymentReleasedEmail({
        sellerEmail: order.seller.email,
        sellerName: order.seller.firstName || "Seller",
        orderId: order.id,
        productTitle: order.product.title,
        payoutAmount: transferAmountInPence / 100,
        releaseReason: "buyer_confirmed",
      });
      console.log("Payment released email sent to seller:", order.seller.email);
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error("Failed to send payment released email:", emailError);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      transferId: transfer.id,
      amountTransferred: transferAmountInPence / 100,
      paymentHoldStatus: "RELEASED",
    });
  } catch (error) {
    console.error("Error confirming receipt:", error);

    // Handle Stripe-specific errors
    if (error instanceof Error && error.message.includes("stripe")) {
      return NextResponse.json(
        { error: "Payment transfer failed. Please try again or contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Failed to confirm receipt" }, { status: 500 });
  }
}
