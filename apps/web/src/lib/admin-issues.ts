import { prisma, type OrderIssueResolution } from "@buttergolf/db";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  AdminOrderError,
  refundOrder,
  releaseOrderToSeller,
  setHoldStatus,
} from "@/lib/admin-orders";
import { sendOrderIssueResolvedEmail } from "@/lib/email";

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
  /** Set when DISMISSED could not unfreeze the hold (Stripe chargeback still open). */
  warning?: string;
}

/**
 * Close a buyer-raised issue with a decision. The money moves first (refund
 * or release, via the same helpers the order page uses); only if that
 * succeeds is the issue marked resolved, so a Stripe failure leaves it open
 * for another go. DISMISSED moves no money and hands the hold back to HELD.
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
  let warning: string | undefined;

  switch (input.resolution) {
    case "REFUNDED":
      await refundOrder(issue.orderId, {
        actorId: input.actorId,
        viaIssue: true,
        reverseTransfer: input.reverseTransfer,
        reason,
      });
      break;
    case "RELEASED":
      await releaseOrderToSeller(issue.orderId, { actorId: input.actorId, viaIssue: true, reason });
      break;
    case "DISMISSED":
      // Nothing to move. The unfreeze below runs after the issue is closed,
      // because setHoldStatus refuses while an issue is still open.
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
      metadata: { orderId: issue.orderId, resolution: input.resolution, note: input.note ?? null },
    });
  });

  if (input.resolution === "DISMISSED" && issue.order.paymentHoldStatus === "DISPUTED") {
    try {
      await setHoldStatus(issue.orderId, {
        actorId: input.actorId,
        freeze: false,
        reason: `Issue ${issue.id} dismissed`,
      });
    } catch (error) {
      if (error instanceof AdminOrderError) {
        warning = `Issue closed, but the payout stays frozen: ${error.message}`;
      } else {
        throw error;
      }
    }
  }

  const emails = [
    sendOrderIssueResolvedEmail({
      to: issue.order.buyer.email,
      name: issue.order.buyer.firstName || "there",
      role: "buyer",
      orderId: issue.orderId,
      productTitle: issue.order.product.title,
      resolution: input.resolution,
      note: input.note,
    }),
    sendOrderIssueResolvedEmail({
      to: issue.order.seller.email,
      name: issue.order.seller.firstName || "there",
      role: "seller",
      orderId: issue.orderId,
      productTitle: issue.order.product.title,
      resolution: input.resolution,
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

  return { issueId: issue.id, resolution: input.resolution, warning };
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
