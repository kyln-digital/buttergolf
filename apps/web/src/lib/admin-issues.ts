import { prisma, type OrderIssueResolution } from "@buttergolf/db";
import { recordAdminAction } from "@/lib/admin-audit";
import { AdminOrderError, refundOrder, releaseOrderToSeller } from "@/lib/admin-orders";
import { sendOrderIssueResolvedEmail } from "@/lib/email";
import { stripe } from "@/lib/stripe";

export const ISSUE_RESOLUTIONS: OrderIssueResolution[] = ["REFUNDED", "RELEASED", "DISMISSED"];

export function isIssueResolution(value: unknown): value is OrderIssueResolution {
  return typeof value === "string" && (ISSUE_RESOLUTIONS as string[]).includes(value);
}

export interface ResolveIssueInput {
  actorId: string;
  resolution: OrderIssueResolution;
  note?: string;
  /** For REFUNDED when the seller was already paid out. */
  reverseTransfer?: boolean;
}

export interface ResolveIssueResult {
  issueId: string;
  resolution: OrderIssueResolution;
  /** RELEASED, but the seller hasn't finished payout setup: the transfer goes out when they do. */
  parked: boolean;
  /** Something staff should know that didn't stop the resolution. */
  warning?: string;
}

/**
 * Close a buyer-raised issue with a decision.
 *
 * Order of operations is what makes this safe to retry:
 * - REFUNDED / RELEASED: the money moves first (same helpers as the order
 *   page). Only if that succeeds is the issue marked resolved, so a Stripe
 *   failure leaves it open for another go.
 * - DISMISSED: nothing moves. The Stripe chargeback check runs before any
 *   write; then the issue is resolved and the hold returned to HELD in one
 *   transaction, so the two can never disagree. If Stripe still has a
 *   chargeback open the hold stays DISPUTED and the dispute-closed webhook
 *   unfreezes it later.
 */
export async function resolveIssue(
  issueId: string,
  input: ResolveIssueInput
): Promise<ResolveIssueResult> {
  const issue = await prisma.orderIssue.findUnique({
    where: { id: issueId },
    include: {
      order: {
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          paymentHoldStatus: true,
          stripeChargeId: true,
          product: { select: { title: true } },
          buyer: { select: { email: true, firstName: true } },
          seller: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (!issue) throw new AdminOrderError("Issue not found", 404);
  if (issue.status === "RESOLVED") {
    throw new AdminOrderError("This issue has already been resolved", 409);
  }

  const reason = `Issue ${issue.id}${input.note ? `: ${input.note}` : ""}`;
  let parked = false;
  let warning: string | undefined;
  let unfreeze = false;

  switch (input.resolution) {
    case "REFUNDED":
      await refundOrder(issue.orderId, {
        actorId: input.actorId,
        viaIssue: true,
        reverseTransfer: input.reverseTransfer,
        reason,
      });
      break;
    case "RELEASED": {
      const release = await releaseOrderToSeller(issue.orderId, {
        actorId: input.actorId,
        viaIssue: true,
        reason,
      });
      parked = release.parked;
      if (parked) {
        warning =
          "Decision recorded, but the seller hasn't finished payout setup. The transfer goes out automatically once they do.";
      }
      break;
    }
    case "DISMISSED":
      if (issue.order.paymentHoldStatus === "DISPUTED") {
        // Read Stripe before writing anything: a failure here leaves the
        // issue open and the whole call retryable.
        const charge = issue.order.stripeChargeId
          ? await stripe.charges.retrieve(issue.order.stripeChargeId)
          : null;
        if (charge?.disputed) {
          warning =
            "Issue closed, but Stripe still has a chargeback open on this payment; the payout unfreezes when that closes.";
        } else {
          unfreeze = true;
        }
      }
      break;
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderIssue.update({
      where: { id: issue.id },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        resolutionNote: input.note ?? null,
        resolvedById: input.actorId,
        resolvedAt: new Date(),
      },
    });
    await recordAdminAction(tx, {
      actorId: input.actorId,
      action: "issue.resolve",
      targetType: "issue",
      targetId: issue.id,
      metadata: {
        orderId: issue.orderId,
        resolution: input.resolution,
        parked,
        note: input.note ?? null,
      },
    });
    if (unfreeze) {
      await tx.order.updateMany({
        where: { id: issue.orderId, paymentHoldStatus: "DISPUTED" },
        data: { paymentHoldStatus: "HELD" },
      });
      await recordAdminAction(tx, {
        actorId: input.actorId,
        action: "order.unfreeze",
        targetType: "order",
        targetId: issue.orderId,
        metadata: { from: "DISPUTED", reason: `Issue ${issue.id} dismissed` },
      });
    }
  });

  const emails = [
    sendOrderIssueResolvedEmail({
      to: issue.order.buyer.email,
      name: issue.order.buyer.firstName || "there",
      role: "buyer",
      orderId: issue.orderId,
      productTitle: issue.order.product.title,
      resolution: input.resolution,
      parked,
      note: input.note,
    }),
    sendOrderIssueResolvedEmail({
      to: issue.order.seller.email,
      name: issue.order.seller.firstName || "there",
      role: "seller",
      orderId: issue.orderId,
      productTitle: issue.order.product.title,
      resolution: input.resolution,
      parked,
      note: input.note,
    }),
  ];
  void Promise.allSettled(emails).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Issue resolution email failed:", result.reason);
      }
    }
  });

  return { issueId: issue.id, resolution: input.resolution, parked, warning };
}

export async function triageIssue(
  issueId: string,
  input: { actorId: string; status: "OPEN" | "UNDER_REVIEW"; note?: string }
): Promise<void> {
  const issue = await prisma.orderIssue.findUnique({
    where: { id: issueId },
    select: { id: true, status: true },
  });
  if (!issue) throw new AdminOrderError("Issue not found", 404);
  if (issue.status === "RESOLVED") {
    throw new AdminOrderError("This issue has already been resolved", 409);
  }
  if (issue.status === input.status && !input.note) return;

  await prisma.$transaction(async (tx) => {
    await tx.orderIssue.update({ where: { id: issue.id }, data: { status: input.status } });
    await recordAdminAction(tx, {
      actorId: input.actorId,
      action: "issue.triage",
      targetType: "issue",
      targetId: issue.id,
      metadata: { from: issue.status, to: input.status, note: input.note ?? null },
    });
  });
}
