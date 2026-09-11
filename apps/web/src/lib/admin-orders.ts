import { prisma, type PaymentHoldStatus, type ShipmentStatus } from "@buttergolf/db";
import { stripe } from "@/lib/stripe";
import { sendPaymentReleasedEmail } from "@/lib/email";
import { calculateAutoReleaseDate } from "@/lib/pricing";
import { recordAdminAction } from "@/lib/admin-audit";

/**
 * Staff actions that move money or override an order's state. Every function
 * here mirrors an existing automated path so the two can never disagree:
 *
 * - releaseOrderToSeller: the confirm-receipt / auto-release transfer, with
 *   the same HELD→RELEASED claim and the same `release:<orderId>` idempotency
 *   key, so a staff release can never double up with the cron.
 * - refundOrder: a Stripe refund plus the same order/product bookkeeping the
 *   charge.refunded webhook does (applyFullRefundToOrder is shared with it).
 * - setHoldStatus / overrideShipmentStatus: the transitions the webhooks make,
 *   done by hand when a carrier or Stripe never told us.
 *
 * Errors a staff member can act on are AdminOrderError with a 4xx status;
 * anything else is a real failure and propagates.
 */

export class AdminOrderError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 = 400
  ) {
    super(message);
    this.name = "AdminOrderError";
  }
}

/** Holds a staff release may start from. DISPUTED is included: resolving an issue in the seller's favour is a release. */
const RELEASABLE_HOLDS: PaymentHoldStatus[] = ["HELD", "DISPUTED", "PENDING_SELLER_ONBOARDING"];

/** Holds a refund takes out of the escrow path. Same set as the webhook. */
const REFUNDABLE_HOLDS: PaymentHoldStatus[] = ["HELD", "PENDING_SELLER_ONBOARDING", "DISPUTED"];

/** After dispatch the item is gone; the listing must not become buyable again. */
const RELISTABLE_SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "CANCELLED", "RETURNED"];

async function loadOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { seller: true, product: true, buyer: true, issue: true },
  });
  if (!order) throw new AdminOrderError("Order not found", 404);
  return order;
}

// ─── Refunds ─────────────────────────────────────────────────────────────────

export interface FullRefundOutcome {
  productRelisted: boolean;
  /** The seller had already been paid; the transfer needs reversing (or was). */
  refundAfterPayout: boolean;
}

/**
 * Order and product bookkeeping for a full refund. Shared by the
 * charge.refunded webhook and the staff refund so the two apply identical
 * rules whichever lands first (both are idempotent).
 *
 * `status` defaults to REFUNDED, but a CANCELLED order stays CANCELLED when
 * the webhook catches up after a staff cancellation.
 */
export async function applyFullRefundToOrder(
  orderId: string,
  options: { status?: "REFUNDED" | "CANCELLED" } = {}
): Promise<FullRefundOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      productId: true,
      shipmentStatus: true,
      stripeTransferId: true,
    },
  });
  if (!order) throw new AdminOrderError("Order not found", 404);

  const status = options.status ?? (order.status === "CANCELLED" ? "CANCELLED" : "REFUNDED");
  await prisma.order.update({ where: { id: order.id }, data: { status } });

  // Take the order out of the escrow release path so neither confirm-receipt
  // nor the auto-release cron can transfer funds after the buyer got theirs
  // back. Only un-released holds can transition.
  const holdUpdate = await prisma.order.updateMany({
    where: { id: order.id, paymentHoldStatus: { in: REFUNDABLE_HOLDS } },
    data: { paymentHoldStatus: "REFUNDED" },
  });
  const refundAfterPayout = holdUpdate.count === 0 && Boolean(order.stripeTransferId);

  let productRelisted = false;
  if (RELISTABLE_SHIPMENT_STATUSES.includes(order.shipmentStatus)) {
    await prisma.product.update({ where: { id: order.productId }, data: { isSold: false } });
    productRelisted = true;
  }

  return { productRelisted, refundAfterPayout };
}

/**
 * A direct refund or release while a buyer issue is still open would leave
 * the issue dangling (or make its own resolution fail later). Staff resolve
 * the issue instead; resolveIssue passes `viaIssue` to get through.
 */
function assertNoOpenIssue(
  order: { issue: { status: string } | null },
  viaIssue: boolean | undefined,
  verb: string
) {
  if (!viaIssue && order.issue && order.issue.status !== "RESOLVED") {
    throw new AdminOrderError(
      `A buyer issue is open on this order. Resolve the issue (${verb}) instead of acting on the order directly.`,
      409
    );
  }
}

export interface RefundOrderInput {
  actorId: string;
  /** Set by resolveIssue; lets the action through an open issue. */
  viaIssue?: boolean;
  /** Omit for a full refund of whatever is still refundable. */
  amountPence?: number;
  /** Claw the payout back from the seller's Connect account first. Required once a transfer exists. */
  reverseTransfer?: boolean;
  /** Mark the order CANCELLED rather than REFUNDED (seller couldn't fulfil). Full refunds only. */
  cancel?: boolean;
  reason?: string;
}

export interface RefundOrderResult {
  refundId: string;
  amountPence: number;
  full: boolean;
  reversedPence: number;
  outcome: FullRefundOutcome | null;
}

export async function refundOrder(
  orderId: string,
  input: RefundOrderInput
): Promise<RefundOrderResult> {
  const order = await loadOrder(orderId);

  if (!order.stripePaymentId) {
    throw new AdminOrderError("This order has no Stripe payment to refund");
  }
  if (order.paymentHoldStatus === "REFUNDED" || order.status === "REFUNDED") {
    throw new AdminOrderError("This order has already been refunded", 409);
  }
  assertNoOpenIssue(order, input.viaIssue, "refund the buyer");

  const charge = order.stripeChargeId ? await stripe.charges.retrieve(order.stripeChargeId) : null;
  const chargedPence = charge?.amount ?? Math.round(order.amountTotal * 100);
  const refundedPence = charge?.amount_refunded ?? 0;
  const remainingPence = chargedPence - refundedPence;

  if (remainingPence <= 0) {
    throw new AdminOrderError("Nothing left to refund on this payment", 409);
  }

  const amountPence = input.amountPence ?? remainingPence;
  if (!Number.isInteger(amountPence) || amountPence <= 0 || amountPence > remainingPence) {
    throw new AdminOrderError(
      `Refund must be between £0.01 and £${(remainingPence / 100).toFixed(2)}`
    );
  }
  const full = amountPence === remainingPence;

  if (input.cancel && !full) {
    throw new AdminOrderError("Only a full refund can cancel the order");
  }

  // Seller already paid: the money has to come back from their Connect
  // balance before we refund the buyer, or the platform eats it.
  let reversedPence = 0;
  if (order.stripeTransferId) {
    if (!input.reverseTransfer) {
      throw new AdminOrderError(
        "The seller has already been paid out for this order. Confirm reversing the payout to continue."
      );
    }
    const transfer = await stripe.transfers.retrieve(order.stripeTransferId);
    const reversible = transfer.amount - transfer.amount_reversed;
    reversedPence = Math.min(amountPence, Math.max(reversible, 0));
    if (reversedPence > 0) {
      await stripe.transfers.createReversal(
        order.stripeTransferId,
        {
          amount: reversedPence,
          metadata: { orderId: order.id, actorId: input.actorId, reason: input.reason ?? "" },
        },
        { idempotencyKey: `admin-reversal:${order.id}:${refundedPence}:${amountPence}` }
      );
    }
  }

  // Keyed on order + what was already refunded + this amount. A double-click
  // (same starting point, same amount) is deduped by Stripe; a second
  // deliberate refund of the same amount starts from a different
  // amount_refunded, so it gets its own key and its own refund.
  const refund = await stripe.refunds.create(
    {
      payment_intent: order.stripePaymentId,
      amount: amountPence,
      metadata: {
        orderId: order.id,
        actorId: input.actorId,
        reason: input.reason ?? "",
        source: "admin",
      },
    },
    { idempotencyKey: `admin-refund:${order.id}:${refundedPence}:${amountPence}` }
  );

  const outcome = full
    ? await applyFullRefundToOrder(order.id, { status: input.cancel ? "CANCELLED" : "REFUNDED" })
    : null;

  await recordAdminAction(prisma, {
    actorId: input.actorId,
    action: input.cancel ? "order.cancel" : "order.refund",
    targetType: "order",
    targetId: order.id,
    metadata: {
      amountPence,
      full,
      refundId: refund.id,
      reversedPence,
      reason: input.reason ?? null,
    },
  });

  return { refundId: refund.id, amountPence, full, reversedPence, outcome };
}

// ─── Release ─────────────────────────────────────────────────────────────────

export interface ReleaseOrderInput {
  actorId: string;
  reason?: string;
  /** Set by resolveIssue; lets the action through an open issue. */
  viaIssue?: boolean;
}

export type ReleaseOrderResult =
  | { parked: true; transferId?: undefined; amountPence: number }
  | { parked: false; transferId: string; amountPence: number };

/**
 * Pay the seller now. Same preconditions, claim and idempotency key as the
 * buyer's confirm-receipt, so the auto-release cron and this can never both
 * mint a transfer for one order.
 */
export async function releaseOrderToSeller(
  orderId: string,
  input: ReleaseOrderInput
): Promise<ReleaseOrderResult> {
  const order = await loadOrder(orderId);

  if (order.stripeTransferId || order.paymentHoldStatus === "RELEASED") {
    throw new AdminOrderError("Payment has already been released to the seller", 409);
  }
  if (!RELEASABLE_HOLDS.includes(order.paymentHoldStatus)) {
    throw new AdminOrderError(
      `Cannot release an order whose payment is ${order.paymentHoldStatus}`
    );
  }

  assertNoOpenIssue(order, input.viaIssue, "release to the seller");

  const amountPence = Math.round((order.stripeSellerPayout || 0) * 100);
  if (amountPence <= 0) {
    throw new AdminOrderError("This order has no seller payout amount recorded");
  }

  if (order.stripeChargeId) {
    const charge = await stripe.charges.retrieve(order.stripeChargeId);
    if (charge.refunded || (charge.amount_refunded || 0) > 0) {
      throw new AdminOrderError(
        "The buyer's payment has been refunded; there is nothing to release"
      );
    }
    if (charge.disputed) {
      throw new AdminOrderError(
        "Stripe has an open chargeback on this payment. Wait for it to close before releasing."
      );
    }
  }

  const previousHold = order.paymentHoldStatus;
  const sellerOnboarded = Boolean(
    order.seller.stripeConnectId && order.seller.stripeOnboardingComplete
  );

  if (!sellerOnboarded) {
    // Park it exactly as confirm-receipt does; the Connect webhook / cron
    // drain PENDING_SELLER_ONBOARDING once the seller finishes.
    await prisma.order.updateMany({
      where: { id: order.id, paymentHoldStatus: previousHold, stripeTransferId: null },
      data: {
        paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
        buyerConfirmedAt: order.buyerConfirmedAt ?? new Date(),
      },
    });
    await recordAdminAction(prisma, {
      actorId: input.actorId,
      action: "order.release",
      targetType: "order",
      targetId: order.id,
      metadata: { parked: true, amountPence, reason: input.reason ?? null },
    });
    return { parked: true, amountPence };
  }

  const claimed = await prisma.order.updateMany({
    where: { id: order.id, paymentHoldStatus: previousHold, stripeTransferId: null },
    data: {
      paymentHoldStatus: "RELEASED",
      buyerConfirmedAt: order.buyerConfirmedAt ?? new Date(),
    },
  });
  if (claimed.count === 0) {
    throw new AdminOrderError(
      "Another process just changed this order. Reload and try again.",
      409
    );
  }

  let transferId: string;
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountPence,
        currency: "gbp",
        destination: order.seller.stripeConnectId!,
        transfer_group: order.id,
        ...(order.stripeChargeId ? { source_transaction: order.stripeChargeId } : {}),
        metadata: {
          orderId: order.id,
          productId: order.productId,
          sellerId: order.sellerId,
          reason: "admin_release",
          actorId: input.actorId,
        },
      },
      { idempotencyKey: `release:${order.id}` }
    );
    transferId = transfer.id;
  } catch (stripeError) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentHoldStatus: previousHold },
    });
    throw stripeError;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentReleasedAt: new Date(),
      stripeTransferId: transferId,
      stripePayoutStatus: "completed",
    },
  });

  await recordAdminAction(prisma, {
    actorId: input.actorId,
    action: "order.release",
    targetType: "order",
    targetId: order.id,
    metadata: { transferId, amountPence, reason: input.reason ?? null },
  });

  try {
    await sendPaymentReleasedEmail({
      sellerEmail: order.seller.email,
      sellerName: order.seller.firstName || "Seller",
      orderId: order.id,
      productTitle: order.product.title,
      payoutAmount: amountPence / 100,
      releaseReason: "admin_released",
    });
  } catch (emailError) {
    console.error("Failed to send payment released email:", emailError);
  }

  return { parked: false, transferId, amountPence };
}

// ─── Hold freeze / unfreeze ──────────────────────────────────────────────────

export interface SetHoldInput {
  actorId: string;
  freeze: boolean;
  reason?: string;
}

export async function setHoldStatus(
  orderId: string,
  input: SetHoldInput
): Promise<{ paymentHoldStatus: PaymentHoldStatus }> {
  const order = await loadOrder(orderId);

  if (input.freeze) {
    if (order.paymentHoldStatus === "DISPUTED") return { paymentHoldStatus: "DISPUTED" };
    const frozen = await prisma.order.updateMany({
      where: { id: order.id, paymentHoldStatus: { in: ["HELD", "PENDING_SELLER_ONBOARDING"] } },
      data: { paymentHoldStatus: "DISPUTED" },
    });
    if (frozen.count === 0) {
      throw new AdminOrderError(
        `Cannot freeze an order whose payment is ${order.paymentHoldStatus}`
      );
    }
  } else {
    if (order.paymentHoldStatus !== "DISPUTED") {
      throw new AdminOrderError("This order's payment is not frozen");
    }
    if (order.issue && order.issue.status !== "RESOLVED") {
      throw new AdminOrderError(
        "A buyer issue is open on this order. Resolve the issue instead of unfreezing directly."
      );
    }
    if (order.stripeChargeId) {
      const charge = await stripe.charges.retrieve(order.stripeChargeId);
      if (charge.disputed) {
        throw new AdminOrderError(
          "Stripe still has an open chargeback on this payment; it will unfreeze when that closes."
        );
      }
    }
    await prisma.order.updateMany({
      where: { id: order.id, paymentHoldStatus: "DISPUTED" },
      data: { paymentHoldStatus: "HELD" },
    });
  }

  await recordAdminAction(prisma, {
    actorId: input.actorId,
    action: input.freeze ? "order.freeze" : "order.unfreeze",
    targetType: "order",
    targetId: order.id,
    metadata: { from: order.paymentHoldStatus, reason: input.reason ?? null },
  });

  return { paymentHoldStatus: input.freeze ? "DISPUTED" : "HELD" };
}

// ─── Shipment override ───────────────────────────────────────────────────────

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "PENDING",
  "PRE_TRANSIT",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURNED",
  "FAILED",
  "CANCELLED",
];

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === "string" && (SHIPMENT_STATUSES as string[]).includes(value);
}

export interface OverrideShipmentInput {
  actorId: string;
  shipmentStatus: ShipmentStatus;
  reason?: string;
}

/**
 * Set the shipment status by hand, with the same side effects the ShipEngine
 * webhook applies: shippedAt on first transit, deliveredAt and the 14-day
 * auto-release clock on delivery. Order status follows for the forward
 * states; returns/failures leave it alone (staff refund or cancel separately).
 */
export async function overrideShipmentStatus(orderId: string, input: OverrideShipmentInput) {
  const order = await loadOrder(orderId);
  const { shipmentStatus } = input;
  const now = new Date();

  const data: {
    shipmentStatus: ShipmentStatus;
    status?: "SHIPPED" | "DELIVERED";
    shippedAt?: Date;
    deliveredAt?: Date;
    autoReleaseAt?: Date;
  } = { shipmentStatus };

  if (
    (shipmentStatus === "PRE_TRANSIT" ||
      shipmentStatus === "IN_TRANSIT" ||
      shipmentStatus === "OUT_FOR_DELIVERY") &&
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED"
  ) {
    data.status = "SHIPPED";
    if (!order.shippedAt) data.shippedAt = now;
  }

  if (shipmentStatus === "DELIVERED") {
    if (order.status !== "CANCELLED" && order.status !== "REFUNDED") data.status = "DELIVERED";
    if (!order.shippedAt) data.shippedAt = now;
    data.deliveredAt = order.deliveredAt ?? now;
    if (!order.autoReleaseAt) data.autoReleaseAt = calculateAutoReleaseDate(data.deliveredAt);
  }

  const updated = await prisma.order.update({ where: { id: order.id }, data });

  await recordAdminAction(prisma, {
    actorId: input.actorId,
    action: "order.shipment",
    targetType: "order",
    targetId: order.id,
    metadata: {
      from: order.shipmentStatus,
      to: shipmentStatus,
      reason: input.reason ?? null,
    },
  });

  return updated;
}
