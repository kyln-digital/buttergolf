"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Input, Row, Text } from "@buttergolf/ui";
import { ExternalLink } from "@tamagui/lucide-icons";
import { adminCall } from "../../_components/admin-client";
import {
  ActionButton,
  AdminTable,
  CellLink,
  CellText,
  KeyValue,
  Notice,
  PageHeader,
  Section,
  StatusBadge,
} from "../../_components/AdminUi";
import { formatDay, formatWhen, fullName, gbp, shortId } from "../../_components/targets";

export interface UserDetailData {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  imageUrl: string | null;
  role: "USER" | "SUPPORT" | "ADMIN";
  suspendedAt: string | null;
  suspendedReason: string | null;
  isDeleted: boolean;
  createdAt: string;
  averageRating: number | null;
  ratingCount: number;
  stripeConnectId: string | null;
  stripeAccountStatus: string | null;
  stripeOnboardingComplete: boolean;
  stripeRequirementsDeadline: string | null;
  counts: {
    products: number;
    ordersPurchased: number;
    ordersSold: number;
    buyerConversations: number;
    sellerConversations: number;
    ratingsReceived: number;
  };
  isBootstrapAdmin: boolean;
}

interface OrderRow {
  id: string;
  title: string;
  amountTotal: number;
  status: string;
  paymentHoldStatus: string;
  createdAt: string;
}

interface ListingRow {
  id: string;
  title: string;
  price: number;
  isSold: boolean;
  isDraft: boolean;
  hiddenAt: string | null;
  createdAt: string;
}

interface IssueRow {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  metadata: string | null;
  createdAt: string;
  actor: string;
}

interface Props {
  user: UserDetailData;
  addresses: { id: string; name: string; line: string; isDefault: boolean }[];
  listings: ListingRow[];
  purchases: OrderRow[];
  sales: OrderRow[];
  issues: IssueRow[];
  auditTrail: AuditRow[];
  links: { clerk: string; stripe: string | null };
  viewer: { id: string; canSuspend: boolean; canChangeRole: boolean };
}

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

function ordersColumns(): Parameters<typeof AdminTable<OrderRow>>[0]["columns"] {
  return [
    {
      key: "id",
      label: "Order",
      width: 110,
      render: (order) => (
        <CellLink href={`/admin/orders/${order.id}`}>{shortId(order.id)}</CellLink>
      ),
    },
    { key: "title", label: "Item", flex: 2, render: (order) => <CellText>{order.title}</CellText> },
    {
      key: "total",
      label: "Total",
      width: 100,
      render: (order) => <CellText>{gbp(order.amountTotal)}</CellText>,
    },
    {
      key: "status",
      label: "Status",
      width: 150,
      render: (order) => <StatusBadge value={order.status} />,
    },
    {
      key: "hold",
      label: "Payout",
      width: 170,
      render: (order) => <StatusBadge value={order.paymentHoldStatus} />,
    },
    {
      key: "when",
      label: "Placed",
      width: 120,
      render: (order) => <CellText secondary>{formatDay(order.createdAt)}</CellText>,
    },
  ];
}

export function UserDetail({
  user,
  addresses,
  listings,
  purchases,
  sales,
  issues,
  auditTrail,
  links,
  viewer,
}: Props) {
  const router = useRouter();
  const [suspendReason, setSuspendReason] = useState("");
  const isSelf = viewer.id === user.id;
  const isStaff = user.role !== "USER" || user.isBootstrapAdmin;

  const suspend = async (suspendNow: boolean) => {
    const result = await adminCall(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: suspendNow ? { suspend: true, reason: suspendReason.trim() } : { suspend: false },
    });
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  };

  const setRole = async (role: "USER" | "SUPPORT" | "ADMIN") => {
    const result = await adminCall(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: { role },
    });
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  };

  return (
    <Column gap="$lg">
      <PageHeader
        title={fullName(user)}
        description={user.email}
        actions={
          <>
            <ExternalButton href={links.clerk} label="Clerk" />
            {links.stripe && <ExternalButton href={links.stripe} label="Stripe account" />}
          </>
        }
      />

      {user.isDeleted && (
        <Notice tone="error">This account was deleted in Clerk. Details were anonymised.</Notice>
      )}
      {user.suspendedAt && (
        <Notice tone="warning">
          Suspended on {formatWhen(user.suspendedAt)}
          {user.suspendedReason ? ` — ${user.suspendedReason}` : ""}
        </Notice>
      )}

      <Row gap="$lg" flexWrap="wrap" alignItems="flex-start">
        <Column flex={1} minWidth={320} gap="$lg">
          <Section title="Account">
            <Column gap="$sm">
              <KeyValue label="Role">
                <Row gap="$xs" alignItems="center" flexWrap="wrap">
                  <StatusBadge value={user.role} />
                  {user.isBootstrapAdmin && (
                    <Text size="$3" color="$textSecondary">
                      (ADMIN via ADMIN_USER_IDS, whatever the stored role)
                    </Text>
                  )}
                </Row>
              </KeyValue>
              <KeyValue label="User id">{user.id}</KeyValue>
              <KeyValue label="Clerk id">{user.clerkId}</KeyValue>
              <KeyValue label="Phone">{user.phone ?? "—"}</KeyValue>
              <KeyValue label="Joined">{formatWhen(user.createdAt)}</KeyValue>
              <KeyValue label="Rating">
                {user.ratingCount > 0
                  ? `${(user.averageRating ?? 0).toFixed(1)} from ${user.ratingCount} rating${user.ratingCount === 1 ? "" : "s"}`
                  : "No ratings yet"}
              </KeyValue>
              <KeyValue label="Activity">
                {`${user.counts.products} listings · ${user.counts.ordersPurchased} bought · ${user.counts.ordersSold} sold · ${user.counts.buyerConversations + user.counts.sellerConversations} conversations`}
              </KeyValue>
            </Column>
          </Section>

          <Section title="Payouts (Stripe Connect)">
            <Column gap="$sm">
              <KeyValue label="Account">{user.stripeConnectId ?? "Not created"}</KeyValue>
              <KeyValue label="Onboarding">
                {user.stripeOnboardingComplete ? "Complete" : "Incomplete"}
              </KeyValue>
              <KeyValue label="Status">{user.stripeAccountStatus ?? "—"}</KeyValue>
              <KeyValue label="Requirements due">
                {user.stripeRequirementsDeadline
                  ? formatWhen(user.stripeRequirementsDeadline)
                  : "—"}
              </KeyValue>
            </Column>
          </Section>

          <Section title="Addresses">
            {addresses.length === 0 ? (
              <Text size="$4" color="$textSecondary">
                None saved.
              </Text>
            ) : (
              <Column gap="$sm">
                {addresses.map((address) => (
                  <Row key={address.id} gap="$sm" alignItems="center" flexWrap="wrap">
                    <Text size="$4" color="$text">
                      {address.name}: {address.line}
                    </Text>
                    {address.isDefault && <StatusBadge value="DEFAULT" />}
                  </Row>
                ))}
              </Column>
            )}
          </Section>
        </Column>

        <Column width={340} gap="$lg">
          <Section title="Actions">
            {isSelf ? (
              <Text size="$4" color="$textSecondary">
                You can&apos;t suspend or change your own account.
              </Text>
            ) : (
              <Column gap="$md">
                {viewer.canSuspend &&
                  !user.isDeleted &&
                  (user.suspendedAt ? (
                    <ActionButton
                      label="Lift suspension"
                      busyLabel="Lifting..."
                      variant="primary"
                      confirm="Lift the suspension? Their listings become visible again immediately."
                      onRun={() => suspend(false)}
                    />
                  ) : isStaff ? (
                    <Text size="$4" color="$textSecondary">
                      Staff accounts can&apos;t be suspended. Change the role to USER first.
                    </Text>
                  ) : (
                    <Column gap="$sm">
                      <Input
                        value={suspendReason}
                        onChangeText={setSuspendReason}
                        placeholder="Reason (shown to the user)"
                        size="$4"
                      />
                      <ActionButton
                        label="Suspend account"
                        busyLabel="Suspending..."
                        tone="error"
                        disabled={suspendReason.trim().length < 5}
                        confirm="Suspend this account? They keep access to their orders but can't list, buy, message or make offers, and their listings are hidden."
                        onRun={() => suspend(true)}
                      />
                    </Column>
                  ))}

                {viewer.canChangeRole && !user.isDeleted && (
                  <Column gap="$sm">
                    <Text size="$3" color="$textSecondary" fontWeight="600">
                      ROLE
                    </Text>
                    <Row gap="$xs" flexWrap="wrap">
                      {(["USER", "SUPPORT", "ADMIN"] as const).map((role) => (
                        <ActionButton
                          key={role}
                          label={role}
                          variant={user.role === role ? "primary" : "secondary"}
                          disabled={user.role === role}
                          confirm={
                            role === "USER"
                              ? "Remove staff access from this account?"
                              : `Give this account ${role} access to the admin portal?`
                          }
                          onRun={() => setRole(role)}
                        />
                      ))}
                    </Row>
                  </Column>
                )}

                {!viewer.canSuspend && !viewer.canChangeRole && (
                  <Text size="$4" color="$textSecondary">
                    Suspension and roles need an ADMIN.
                  </Text>
                )}
              </Column>
            )}
          </Section>

          <Section title="Staff actions on this user">
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

      <Section title={`Listings (${user.counts.products})`}>
        <AdminTable
          rows={listings}
          rowKey={(listing) => listing.id}
          emptyText="No listings."
          columns={[
            {
              key: "title",
              label: "Title",
              flex: 3,
              render: (listing) => (
                <CellLink href={`/admin/listings?q=${listing.id}`}>{listing.title}</CellLink>
              ),
            },
            {
              key: "price",
              label: "Price",
              width: 100,
              render: (listing) => <CellText>{gbp(listing.price)}</CellText>,
            },
            {
              key: "state",
              label: "State",
              width: 200,
              render: (listing) => (
                <Row gap="$xs" flexWrap="wrap">
                  {listing.hiddenAt && <StatusBadge value="HIDDEN" />}
                  {listing.isDraft && <StatusBadge value="DRAFT" />}
                  {listing.isSold && <StatusBadge value="SOLD" />}
                  {!listing.hiddenAt && !listing.isDraft && !listing.isSold && (
                    <StatusBadge value="LIVE" />
                  )}
                </Row>
              ),
            },
            {
              key: "when",
              label: "Listed",
              width: 120,
              render: (listing) => <CellText secondary>{formatDay(listing.createdAt)}</CellText>,
            },
          ]}
        />
      </Section>

      <Section title={`Purchases (${user.counts.ordersPurchased})`}>
        <AdminTable
          rows={purchases}
          rowKey={(o) => o.id}
          emptyText="No purchases."
          columns={ordersColumns()}
        />
      </Section>

      <Section title={`Sales (${user.counts.ordersSold})`}>
        <AdminTable
          rows={sales}
          rowKey={(o) => o.id}
          emptyText="No sales."
          columns={ordersColumns()}
        />
      </Section>

      <Section title="Problems reported">
        <AdminTable
          rows={issues}
          rowKey={(issue) => issue.id}
          emptyText="None."
          columns={[
            {
              key: "order",
              label: "Order",
              width: 110,
              render: (issue) => (
                <CellLink href={`/admin/orders/${issue.orderId}`}>
                  {shortId(issue.orderId)}
                </CellLink>
              ),
            },
            {
              key: "reason",
              label: "Reason",
              render: (issue) => <CellText>{issue.reason.replace(/_/g, " ")}</CellText>,
            },
            {
              key: "status",
              label: "Status",
              width: 130,
              render: (issue) => <StatusBadge value={issue.status} />,
            },
            {
              key: "when",
              label: "Opened",
              width: 160,
              render: (issue) => <CellText secondary>{formatWhen(issue.createdAt)}</CellText>,
            },
          ]}
        />
      </Section>
    </Column>
  );
}
