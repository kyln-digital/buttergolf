import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { readJsonObject } from "@/lib/json-body";
import { sendOrderIssueOpenedEmail, sendStaffAlertEmail } from "@/lib/email";
import {
  canOpenIssue,
  ISSUE_DESCRIPTION_MIN,
  ISSUE_REASON_LABELS,
  isIssueReason,
  validateIssueDescription,
} from "@/lib/order-issue-state";
import { formatOrderId } from "@/lib/utils/format";

/**
 * POST /api/orders/[id]/issue
 *
 * The buyer reports a problem with an order. Creates the OrderIssue, freezes
 * the payout hold (DISPUTED) so nothing releases to the seller while staff
 * look, drops a system message into the order conversation so the seller
 * sees it in context, and emails the seller and the staff inbox.
 *
 * Body: { reason: OrderIssueReason, description: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: orderId } = await params;

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { reason } = body;
    if (!isIssueReason(reason)) {
      return NextResponse.json({ error: "Please choose what went wrong" }, { status: 400 });
    }

    const description = validateIssueDescription(body.description);
    if (!description) {
      return NextResponse.json(
        {
          error: `Please describe the problem in at least ${ISSUE_DESCRIPTION_MIN} characters`,
        },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        status: true,
        paymentHoldStatus: true,
        issue: { select: { id: true } },
        product: { select: { title: true } },
        seller: { select: { email: true, firstName: true } },
        conversation: { select: { id: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.buyerId !== user.id) {
      return NextResponse.json(
        { error: "Only the buyer can report a problem with an order" },
        { status: 403 }
      );
    }

    const eligibility = canOpenIssue({
      status: order.status,
      paymentHoldStatus: order.paymentHoldStatus,
      hasIssue: Boolean(order.issue),
    });
    if (eligibility.allowed === false) {
      const { message, reason: why } = eligibility;
      return NextResponse.json({ error: message, reason: why }, { status: 400 });
    }

    const reasonLabel = ISSUE_REASON_LABELS[reason];

    let issue;
    try {
      issue = await prisma.$transaction(async (tx) => {
        const created = await tx.orderIssue.create({
          data: { orderId: order.id, reporterId: user.id, reason, description },
        });

        // Freeze the payout. Every release path already refuses DISPUTED.
        await tx.order.updateMany({
          where: {
            id: order.id,
            paymentHoldStatus: { in: ["HELD", "PENDING_SELLER_ONBOARDING"] },
          },
          data: { paymentHoldStatus: "DISPUTED" },
        });

        if (order.conversation) {
          await tx.message.create({
            data: {
              conversationId: order.conversation.id,
              senderId: user.id,
              type: "SYSTEM",
              content: `Problem reported: ${reasonLabel}. ButterGolf support is reviewing this order and the payout is on hold until it's resolved.`,
            },
          });
        }

        return created;
      });
    } catch (error) {
      // Unique orderId: a concurrent report won the race. (P2002 = unique
      // constraint; checked by code because @buttergolf/db exports Prisma as a type.)
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A problem has already been reported for this order." },
          { status: 409 }
        );
      }
      throw error;
    }

    const buyerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "The buyer";

    // Notifications are best-effort; the issue is already recorded.
    void Promise.allSettled([
      sendOrderIssueOpenedEmail({
        sellerEmail: order.seller.email,
        sellerName: order.seller.firstName || "there",
        buyerName,
        orderId: order.id,
        productTitle: order.product.title,
        reasonLabel,
        description,
      }),
      sendStaffAlertEmail({
        subject: `Problem reported on order ${formatOrderId(order.id)}`,
        lines: [
          `Order: ${order.id}`,
          `Item: ${order.product.title}`,
          `Reason: ${reasonLabel}`,
          `Buyer: ${buyerName}`,
          `Previous hold: ${order.paymentHoldStatus} (now DISPUTED)`,
        ],
        path: `/admin/orders/${order.id}`,
      }),
    ]).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Order issue notification failed:", result.reason);
        }
      }
    });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    console.error("Error reporting order issue:", error);
    return NextResponse.json({ error: "Failed to report the problem" }, { status: 500 });
  }
}
