"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Checkbox,
  Column,
  Input,
  Label,
  Radio,
  RadioGroup,
  RadioIndicator,
  Row,
  Text,
  TextArea,
} from "@buttergolf/ui";
import { ExternalLink } from "@tamagui/lucide-icons";
import type { StripeLinks } from "@/lib/stripe-links";
import { adminCall } from "../../_components/admin-client";
import {
  ActionButton,
  KeyValue,
  Notice,
  PageHeader,
  Section,
  StatusBadge,
} from "../../_components/AdminUi";
import { formatWhen, fullName, gbp, shortId } from "../../_components/targets";

export interface OrderAdminData {
  id: string;
  createdAt: string;
  status: string;
  shipmentStatus: string;
  paymentHoldStatus: string;
  amountTotal: number;
  shippingCost: number;
  buyerProtectionFee: number | null;
  stripePlatformFee: number | null;
  stripeSellerPayout: number | null;
  stripePaymentId: string | null;
  stripeChargeId: string | null;
  stripeTransferId: string | null;
  paymentReleasedAt: string | null;
  autoReleaseAt: string | null;
  buyerConfirmedAt: string | null;
  shippingServiceName: string | null;
  carrier: string | null;
  service: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  labelError: string | null;
  labelAttemptedAt: string | null;
  labelGeneratedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  estimatedDelivery: string | null;
  product: {
    id: string;
    title: string;
    price: number;
    isSold: boolean;
    hidden: boolean;
    imageUrl: string | null;
  };
  buyer: { id: string; firstName: string; lastName: string; email: string };
  seller: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    stripeConnectId: string | null;
    stripeOnboardingComplete: boolean;
  };
  fromAddress: string;
  toAddress: string;
  rating: { rating: number; comment: string | null } | null;
  conversation: { id: string; messages: number } | null;
  issue: {
    id: string;
    reason: string;
    description: string;
    status: string;
    resolution: string | null;
    resolutionNote: string | null;
    createdAt: string;
    resolvedAt: string | null;
    reporter: string;
    resolvedBy: string | null;
  } | null;
}

interface AuditRow {
  id: string;
  action: string;
  metadata: string | null;
  createdAt: string;
  actor: string;
}

interface Viewer {
  canRefund: boolean;
  canRelease: boolean;
  canHold: boolean;
  canShipment: boolean;
  canTriage: boolean;
  canResolve: boolean;
}

const SHIPMENT_STATUSES = [
  "PENDING",
  "PRE_TRANSIT",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURNED",
  "FAILED",
  "CANCELLED",
];

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      size="$3"
      butterVariant="secondary"
      icon={<ExternalLink size={14} />}
      onPress={() => window.open(href, "_blank", "noopener,noreferrer")}
    >
      {label}
    </Button>
  );
}

function LabeledCheckbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <Row gap="$sm" alignItems="center">
      <Checkbox id={id} checked={checked} onChange={onChange} size="sm" />
      <Label htmlFor={id} size="$4" marginBottom={0} cursor="pointer" color="$text">
        {label}
      </Label>
    </Row>
  );
}

export function OrderAdminDetail({
  order,
  links,
  auditTrail,
  viewer,
}: {
  order: OrderAdminData;
  links: StripeLinks;
  auditTrail: AuditRow[];
  viewer: Viewer;
}) {
  const router = useRouter();

  // Refund form
  const [refundAmount, setRefundAmount] = useState("");
  const [reverseTransfer, setReverseTransfer] = useState(false);
  const [cancelOrder, setCancelOrder] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  // Issue resolution form
  const [resolution, setResolution] = useState<"REFUNDED" | "RELEASED" | "DISMISSED" | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [issueReverseTransfer, setIssueReverseTransfer] = useState(false);

  // Shipment override
  const [shipmentTarget, setShipmentTarget] = useState(order.shipmentStatus);
  const [shipmentReason, setShipmentReason] = useState("");

  const [notice, setNotice] = useState<string | null>(null);

  const done = (message: string) => {
    setNotice(message);
    router.refresh();
    return null;
  };

  const run = async (path: string, body: unknown, method: "POST" | "PATCH" = "POST") => {
    const result = await adminCall<{ warning?: string; note?: string }>(path, { method, body });
    if (!result.ok) return result.error;
    return result.data?.warning ?? result.data?.note ?? null;
  };

  const refundable = order.paymentHoldStatus !== "REFUNDED" && order.status !== "REFUNDED";
  const releasable =
    !order.stripeTransferId &&
    ["HELD", "DISPUTED", "PENDING_SELLER_ONBOARDING"].includes(order.paymentHoldStatus);
  const issueOpen = order.issue !== null && order.issue.status !== "RESOLVED";
  const paidOut = Boolean(order.stripeTransferId);

  const refundAmountPence =
    refundAmount.trim() === "" ? undefined : Math.round(Number.parseFloat(refundAmount) * 100);
  const refundAmountValid =
    refundAmountPence === undefined ||
    (Number.isFinite(refundAmountPence) && refundAmountPence > 0);

  return (
    <Column gap="$lg">
      <PageHeader
        title={`Order ${shortId(order.id)}`}
        description={`${order.product.title} · placed ${formatWhen(order.createdAt)}`}
        actions={
          <>
            {links.paymentIntent && (
              <ExternalButton href={links.paymentIntent} label="Stripe payment" />
            )}
            {links.transfer && <ExternalButton href={links.transfer} label="Stripe transfer" />}
            <Link href={`/orders/${order.id}`} style={{ textDecoration: "none" }}>
              <Button size="$3" butterVariant="ghost">
                Customer view
              </Button>
            </Link>
          </>
        }
      />

      <Row gap="$xs" flexWrap="wrap" alignItems="center">
        <StatusBadge value={order.status} />
        <StatusBadge value={order.shipmentStatus} />
        <StatusBadge value={order.paymentHoldStatus} />
        {issueOpen && <StatusBadge value="ISSUE OPEN" />}
      </Row>

      {notice && <Notice tone="info">{notice}</Notice>}
      {paidOut && order.paymentHoldStatus === "REFUNDED" && (
        <Notice tone="error">
          Refunded after the seller was paid. Check the transfer in Stripe was reversed.
        </Notice>
      )}
      {order.paymentHoldStatus === "RELEASED" && !order.stripeTransferId && (
        <Notice tone="warning">
          Marked released but no transfer is recorded. The nightly reconciliation will repair or
          re-queue it.
        </Notice>
      )}
      {order.labelError && !order.labelUrl && (
        <Notice tone="warning">
          Label purchase failed
          {order.labelAttemptedAt ? ` (${formatWhen(order.labelAttemptedAt)})` : ""}:{" "}
          {order.labelError}
        </Notice>
      )}

      {order.issue && (
        <Section title={`Reported problem · ${order.issue.status.replace(/_/g, " ")}`}>
          <Column gap="$md">
            <KeyValue label="Reason">{order.issue.reason.replace(/_/g, " ")}</KeyValue>
            <KeyValue label="Reported by">{`${order.issue.reporter} · ${formatWhen(order.issue.createdAt)}`}</KeyValue>
            <KeyValue label="Description">
              <Text size="$4" color="$text" selectable>
                {order.issue.description}
              </Text>
            </KeyValue>
            {order.issue.status === "RESOLVED" ? (
              <Notice tone="success">
                {`${order.issue.resolution} by ${order.issue.resolvedBy ?? "staff"}${order.issue.resolvedAt ? ` on ${formatWhen(order.issue.resolvedAt)}` : ""}${order.issue.resolutionNote ? ` — ${order.issue.resolutionNote}` : ""}`}
              </Notice>
            ) : (
              <Column gap="$md">
                {viewer.canTriage && order.issue.status === "OPEN" && (
                  <ActionButton
                    label="Mark as under review"
                    onRun={async () => {
                      const error = await run(
                        `/api/admin/issues/${order.issue!.id}`,
                        { status: "UNDER_REVIEW" },
                        "PATCH"
                      );
                      return error ?? done("Marked under review.");
                    }}
                  />
                )}
                {viewer.canResolve ? (
                  <Column gap="$sm">
                    <Text fontWeight="600">Decision</Text>
                    <RadioGroup
                      value={resolution}
                      onValueChange={(value) => setResolution(value as typeof resolution)}
                      gap={0}
                    >
                      {[
                        [
                          "REFUNDED",
                          "Refund the buyer in full" +
                            (paidOut ? " (seller already paid — payout will be reversed)" : ""),
                        ],
                        ["RELEASED", "Release the payout to the seller"],
                        ["DISMISSED", "Close without action (payout back on hold as normal)"],
                      ].map(([value, label]) => (
                        <Row key={value} alignItems="center" gap="$sm" minHeight={36}>
                          <Radio id={`resolution-${value}`} value={value} size="sm">
                            <RadioIndicator />
                          </Radio>
                          <Label
                            htmlFor={`resolution-${value}`}
                            size="$4"
                            marginBottom={0}
                            cursor="pointer"
                            color="$text"
                          >
                            {label}
                          </Label>
                        </Row>
                      ))}
                    </RadioGroup>
                    {resolution === "REFUNDED" && paidOut && (
                      <LabeledCheckbox
                        id="issue-reverse"
                        checked={issueReverseTransfer}
                        onChange={setIssueReverseTransfer}
                        label="Reverse the seller's payout before refunding"
                      />
                    )}
                    <TextArea
                      value={resolutionNote}
                      onChangeText={setResolutionNote}
                      placeholder="Note to both parties (optional, included in the email)"
                      numberOfLines={3}
                    />
                    <ActionButton
                      label="Resolve issue"
                      busyLabel="Resolving..."
                      variant="primary"
                      disabled={
                        resolution === "" ||
                        (resolution === "REFUNDED" && paidOut && !issueReverseTransfer)
                      }
                      confirm={`Resolve as ${resolution}? This emails the buyer and seller and cannot be undone.`}
                      onRun={async () => {
                        const error = await run(`/api/admin/issues/${order.issue!.id}/resolve`, {
                          resolution,
                          note: resolutionNote.trim() || undefined,
                          reverseTransfer: issueReverseTransfer,
                        });
                        return error ?? done(`Issue resolved: ${resolution}.`);
                      }}
                    />
                  </Column>
                ) : (
                  <Text size="$4" color="$textSecondary">
                    Resolving needs an ADMIN.
                  </Text>
                )}
              </Column>
            )}
          </Column>
        </Section>
      )}

      <Row gap="$lg" flexWrap="wrap" alignItems="flex-start">
        <Column flex={1} minWidth={340} gap="$lg">
          <Section title="Money">
            <Column gap="$sm">
              <KeyValue label="Buyer paid">{gbp(order.amountTotal)}</KeyValue>
              <KeyValue label="Item">{gbp(order.product.price)}</KeyValue>
              <KeyValue label="Shipping">{gbp(order.shippingCost)}</KeyValue>
              <KeyValue label="Buyer protection">
                {order.buyerProtectionFee != null ? gbp(order.buyerProtectionFee) : "—"}
              </KeyValue>
              <KeyValue label="Platform fee">
                {order.stripePlatformFee != null ? gbp(order.stripePlatformFee) : "—"}
              </KeyValue>
              <KeyValue label="Seller payout">
                {order.stripeSellerPayout != null ? gbp(order.stripeSellerPayout) : "—"}
              </KeyValue>
              <KeyValue label="Payment intent">{order.stripePaymentId ?? "—"}</KeyValue>
              <KeyValue label="Charge">{order.stripeChargeId ?? "—"}</KeyValue>
              <KeyValue label="Transfer">{order.stripeTransferId ?? "—"}</KeyValue>
              <KeyValue label="Released">
                {order.paymentReleasedAt ? formatWhen(order.paymentReleasedAt) : "—"}
              </KeyValue>
              <KeyValue label="Auto-release">
                {order.autoReleaseAt
                  ? formatWhen(order.autoReleaseAt)
                  : "Not scheduled (starts on delivery)"}
              </KeyValue>
              <KeyValue label="Buyer confirmed">
                {order.buyerConfirmedAt ? formatWhen(order.buyerConfirmedAt) : "—"}
              </KeyValue>
            </Column>
          </Section>

          <Section title="Shipping">
            <Column gap="$sm">
              <KeyValue label="Service">
                {order.shippingServiceName ?? order.service ?? "—"}
              </KeyValue>
              <KeyValue label="Carrier">{order.carrier ?? "—"}</KeyValue>
              <KeyValue label="Tracking">
                {order.trackingCode ? (
                  order.trackingUrl ? (
                    <Text
                      size="$4"
                      color="$primary"
                      onPress={() =>
                        window.open(order.trackingUrl!, "_blank", "noopener,noreferrer")
                      }
                      cursor="pointer"
                    >
                      {order.trackingCode}
                    </Text>
                  ) : (
                    order.trackingCode
                  )
                ) : (
                  "—"
                )}
              </KeyValue>
              <KeyValue label="Label">
                {order.labelUrl ? (
                  <Text
                    size="$4"
                    color="$primary"
                    onPress={() => window.open(order.labelUrl!, "_blank", "noopener,noreferrer")}
                    cursor="pointer"
                  >
                    Open label
                    {order.labelGeneratedAt ? ` (${formatWhen(order.labelGeneratedAt)})` : ""}
                  </Text>
                ) : (
                  "Not generated"
                )}
              </KeyValue>
              <KeyValue label="Shipped">
                {order.shippedAt ? formatWhen(order.shippedAt) : "—"}
              </KeyValue>
              <KeyValue label="Delivered">
                {order.deliveredAt
                  ? formatWhen(order.deliveredAt)
                  : order.estimatedDelivery
                    ? `Est. ${formatWhen(order.estimatedDelivery)}`
                    : "—"}
              </KeyValue>
              <KeyValue label="From">{order.fromAddress}</KeyValue>
              <KeyValue label="To">{order.toAddress}</KeyValue>
            </Column>
          </Section>

          <Section title="People">
            <Column gap="$sm">
              <KeyValue label="Buyer">
                <Link href={`/admin/users/${order.buyer.id}`} style={{ textDecoration: "none" }}>
                  <Text size="$4" color="$primary" fontWeight="600">
                    {fullName(order.buyer)} · {order.buyer.email}
                  </Text>
                </Link>
              </KeyValue>
              <KeyValue label="Seller">
                <Column gap={0}>
                  <Link href={`/admin/users/${order.seller.id}`} style={{ textDecoration: "none" }}>
                    <Text size="$4" color="$primary" fontWeight="600">
                      {fullName(order.seller)} · {order.seller.email}
                    </Text>
                  </Link>
                  <Text size="$3" color="$textSecondary">
                    Payouts{" "}
                    {order.seller.stripeOnboardingComplete
                      ? "set up"
                      : order.seller.stripeConnectId
                        ? "pending onboarding"
                        : "not started"}
                  </Text>
                </Column>
              </KeyValue>
              <KeyValue label="Listing">
                <Link
                  href={`/admin/listings?q=${order.product.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <Text size="$4" color="$primary" fontWeight="600">
                    {order.product.title}
                    {order.product.hidden ? " (hidden)" : ""}
                  </Text>
                </Link>
              </KeyValue>
              <KeyValue label="Conversation">
                {order.conversation ? `${order.conversation.messages} messages` : "None"}
              </KeyValue>
              <KeyValue label="Rating">
                {order.rating
                  ? `${order.rating.rating}/5${order.rating.comment ? ` — ${order.rating.comment}` : ""}`
                  : "Not yet rated"}
              </KeyValue>
            </Column>
          </Section>
        </Column>

        <Column width={360} gap="$lg">
          <Section title="Payout">
            <Column gap="$md">
              {viewer.canRelease ? (
                <ActionButton
                  label={
                    order.seller.stripeOnboardingComplete
                      ? "Release to seller now"
                      : "Queue release (seller not onboarded)"
                  }
                  busyLabel="Releasing..."
                  variant="primary"
                  disabled={!releasable || issueOpen}
                  confirm={`Release ${order.stripeSellerPayout != null ? gbp(order.stripeSellerPayout) : "the payout"} to the seller?`}
                  onRun={async () => {
                    const error = await run(`/api/admin/orders/${order.id}/release`, {});
                    return error ?? done("Payout released.");
                  }}
                />
              ) : null}
              {issueOpen && (
                <Text size="$3" color="$textSecondary">
                  Resolve the reported problem above to release or unfreeze.
                </Text>
              )}
              {viewer.canHold &&
                (order.paymentHoldStatus === "DISPUTED" ? (
                  <ActionButton
                    label="Unfreeze payout (back to HELD)"
                    disabled={issueOpen}
                    confirm="Unfreeze this payout? The normal release rules apply again."
                    onRun={async () => {
                      const error = await run(`/api/admin/orders/${order.id}/hold`, {
                        freeze: false,
                      });
                      return error ?? done("Payout unfrozen.");
                    }}
                  />
                ) : (
                  <ActionButton
                    label="Freeze payout"
                    disabled={
                      !["HELD", "PENDING_SELLER_ONBOARDING"].includes(order.paymentHoldStatus)
                    }
                    confirm="Freeze this payout? Nothing will release to the seller until it is unfrozen."
                    onRun={async () => {
                      const error = await run(`/api/admin/orders/${order.id}/hold`, {
                        freeze: true,
                      });
                      return error ?? done("Payout frozen.");
                    }}
                  />
                ))}
              {!viewer.canRelease && !viewer.canHold && (
                <Text size="$4" color="$textSecondary">
                  Payout actions need an ADMIN.
                </Text>
              )}
            </Column>
          </Section>

          <Section title="Refund">
            {viewer.canRefund ? (
              <Column gap="$sm">
                <Input
                  value={refundAmount}
                  onChangeText={setRefundAmount}
                  placeholder={`Amount in £ (blank = full, up to ${gbp(order.amountTotal)})`}
                  size="$4"
                  inputMode="decimal"
                />
                {paidOut && (
                  <LabeledCheckbox
                    id="refund-reverse"
                    checked={reverseTransfer}
                    onChange={setReverseTransfer}
                    label="Reverse the seller's payout first"
                  />
                )}
                <LabeledCheckbox
                  id="refund-cancel"
                  checked={cancelOrder}
                  onChange={setCancelOrder}
                  label="Mark order CANCELLED instead of REFUNDED (full refunds only)"
                />
                <Input
                  value={refundReason}
                  onChangeText={setRefundReason}
                  placeholder="Reason (audit log only)"
                  size="$4"
                />
                <ActionButton
                  label={
                    refundAmountPence === undefined
                      ? "Refund in full"
                      : `Refund ${gbp(refundAmountPence / 100)}`
                  }
                  busyLabel="Refunding..."
                  tone="error"
                  disabled={!refundable || !refundAmountValid || (paidOut && !reverseTransfer)}
                  confirm={`Refund ${refundAmountPence === undefined ? "the full amount" : gbp(refundAmountPence / 100)} to the buyer? This cannot be undone.`}
                  onRun={async () => {
                    const error = await run(`/api/admin/orders/${order.id}/refund`, {
                      amountPence: refundAmountPence,
                      reverseTransfer,
                      cancel: cancelOrder,
                      reason: refundReason.trim() || undefined,
                    });
                    return error ?? done("Refund issued.");
                  }}
                />
                {paidOut && !reverseTransfer && refundable && (
                  <Text size="$3" color="$textSecondary">
                    The seller has been paid; tick reverse to claw the payout back first.
                  </Text>
                )}
              </Column>
            ) : (
              <Text size="$4" color="$textSecondary">
                Refunds need an ADMIN.
              </Text>
            )}
          </Section>

          <Section title="Shipment override">
            {viewer.canShipment ? (
              <Column gap="$sm">
                <RadioGroup value={shipmentTarget} onValueChange={setShipmentTarget} gap={0}>
                  {SHIPMENT_STATUSES.map((status) => (
                    <Row key={status} alignItems="center" gap="$sm" minHeight={30}>
                      <Radio id={`ship-${status}`} value={status} size="sm">
                        <RadioIndicator />
                      </Radio>
                      <Label
                        htmlFor={`ship-${status}`}
                        size="$4"
                        marginBottom={0}
                        cursor="pointer"
                        color="$text"
                      >
                        {status.replace(/_/g, " ")}
                      </Label>
                    </Row>
                  ))}
                </RadioGroup>
                <Input
                  value={shipmentReason}
                  onChangeText={setShipmentReason}
                  placeholder="Why (audit log only)"
                  size="$4"
                />
                <ActionButton
                  label="Set shipment status"
                  disabled={shipmentTarget === order.shipmentStatus}
                  confirm={`Set shipment to ${shipmentTarget}?${shipmentTarget === "DELIVERED" ? " This starts the 14-day auto-release clock." : ""}`}
                  onRun={async () => {
                    const error = await run(
                      `/api/admin/orders/${order.id}`,
                      {
                        shipmentStatus: shipmentTarget,
                        reason: shipmentReason.trim() || undefined,
                      },
                      "PATCH"
                    );
                    return error ?? done(`Shipment set to ${shipmentTarget}.`);
                  }}
                />
              </Column>
            ) : (
              <Text size="$4" color="$textSecondary">
                Overrides need an ADMIN.
              </Text>
            )}
          </Section>

          <Section title="Staff actions on this order">
            {auditTrail.length === 0 ? (
              <Text size="$4" color="$textSecondary">
                None.
              </Text>
            ) : (
              <Column gap="$sm">
                {auditTrail.map((entry) => (
                  <Column key={entry.id} gap={0}>
                    <Text size="$4" color="$text">
                      {entry.action} · {entry.actor}
                    </Text>
                    <Text size="$3" color="$textSecondary">
                      {formatWhen(entry.createdAt)}
                      {entry.metadata ? ` · ${entry.metadata}` : ""}
                    </Text>
                  </Column>
                ))}
              </Column>
            )}
          </Section>
        </Column>
      </Row>
    </Column>
  );
}
