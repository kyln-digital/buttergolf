"use client";

import { Column, Row, Text } from "@buttergolf/ui";
import {
  AdminTable,
  CellLink,
  CellText,
  PageHeader,
  Section,
  StatCard,
  StatusBadge,
} from "./AdminUi";
import { formatWhen, gbp, shortId, targetHref } from "./targets";

interface DashboardStats {
  openIssues: number;
  disputedOrders: number;
  stuckPayouts: number;
  labelFailures: number;
  unshipped: number;
  newUsers: number;
  gmvThirtyDays: number;
  ordersThirtyDays: number;
  activeListings: number;
}

interface RecentIssue {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: string;
  productTitle: string;
}

interface RecentAction {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actor: string;
}

export function DashboardView({
  stats,
  recentIssues,
  recentActions,
}: {
  stats: DashboardStats;
  recentIssues: RecentIssue[];
  recentActions: RecentAction[];
}) {
  return (
    <Column gap="$lg">
      <PageHeader title="Dashboard" description="What needs a human, and how the shop is doing." />

      <Column gap="$sm">
        <Text size="$3" color="$textSecondary" fontWeight="600">
          NEEDS ATTENTION
        </Text>
        <Row gap="$md" flexWrap="wrap">
          <StatCard
            label="Open issues"
            value={stats.openIssues}
            href="/admin/issues"
            tone={stats.openIssues > 0 ? "error" : "neutral"}
            hint="Buyer-reported problems awaiting a decision"
          />
          <StatCard
            label="Disputed orders"
            value={stats.disputedOrders}
            href="/admin/orders?hold=DISPUTED"
            tone={stats.disputedOrders > 0 ? "error" : "neutral"}
            hint="Payout frozen: buyer issue or Stripe chargeback"
          />
          <StatCard
            label="Stuck payouts"
            value={stats.stuckPayouts}
            href="/admin/orders?queue=stuck-payouts"
            tone={stats.stuckPayouts > 0 ? "warning" : "neutral"}
            hint="Waiting on seller onboarding, or released without a transfer"
          />
          <StatCard
            label="Label failures"
            value={stats.labelFailures}
            href="/admin/orders?queue=label-failures"
            tone={stats.labelFailures > 0 ? "warning" : "neutral"}
            hint="Paid orders where the postage label couldn't be bought"
          />
          <StatCard
            label="Unshipped > 5 days"
            value={stats.unshipped}
            href="/admin/orders?queue=unshipped"
            tone={stats.unshipped > 0 ? "warning" : "neutral"}
            hint="Paid but not yet dispatched"
          />
        </Row>
      </Column>

      <Column gap="$sm">
        <Text size="$3" color="$textSecondary" fontWeight="600">
          LAST 30 DAYS
        </Text>
        <Row gap="$md" flexWrap="wrap">
          <StatCard
            label="Sales"
            value={gbp(stats.gmvThirtyDays)}
            hint="Excludes cancelled and refunded"
          />
          <StatCard label="Orders" value={stats.ordersThirtyDays} href="/admin/orders" />
          <StatCard label="New users (7d)" value={stats.newUsers} href="/admin/users?sort=newest" />
          <StatCard label="Live listings" value={stats.activeListings} href="/admin/listings" />
        </Row>
      </Column>

      <Section title="Oldest open issues">
        <AdminTable
          rows={recentIssues}
          rowKey={(issue) => issue.id}
          emptyText="No open issues."
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
              key: "item",
              label: "Item",
              flex: 2,
              render: (issue) => <CellText>{issue.productTitle}</CellText>,
            },
            {
              key: "reason",
              label: "Reason",
              render: (issue) => <CellText>{issue.reason.replace(/_/g, " ")}</CellText>,
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (issue) => <CellText>{issue.reporter}</CellText>,
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

      <Section title="Recent staff actions">
        <AdminTable
          rows={recentActions}
          rowKey={(action) => action.id}
          emptyText="No actions recorded yet."
          columns={[
            {
              key: "when",
              label: "When",
              width: 160,
              render: (action) => <CellText secondary>{formatWhen(action.createdAt)}</CellText>,
            },
            { key: "actor", label: "Who", render: (action) => <CellText>{action.actor}</CellText> },
            {
              key: "action",
              label: "Action",
              render: (action) => <CellText>{action.action}</CellText>,
            },
            {
              key: "target",
              label: "Target",
              flex: 2,
              render: (action) => {
                const href = targetHref(action.targetType, action.targetId);
                const label = `${action.targetType} ${shortId(action.targetId)}`;
                return href ? (
                  <CellLink href={href}>{label}</CellLink>
                ) : (
                  <CellText>{label}</CellText>
                );
              },
            },
          ]}
        />
      </Section>
    </Column>
  );
}
