"use client";

import { Column, Row, Text } from "@buttergolf/ui";
import { buildAdminUrl } from "@/lib/admin-url";
import {
  AdminTable,
  CellLink,
  CellText,
  FilterChips,
  Notice,
  PageHeader,
  StatusBadge,
  UrlPagination,
} from "../../_components/AdminUi";
import { formatWhen, gbp, shortId } from "../../_components/targets";

export interface IssueRow {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: string;
  resolvedBy: string | null;
  productTitle: string;
  seller: string;
  amountTotal: number;
  paymentHoldStatus: string;
}

const BASE = "/admin/issues";

function ageInDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export function IssuesTable({
  issues,
  counts,
  view,
  highlight,
  page,
  totalPages,
  total,
}: {
  issues: IssueRow[];
  counts: { open: number; underReview: number; resolved: number };
  view: string;
  highlight?: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const params = { view };
  const chip = (value: string, label: string, count?: number) => ({
    label,
    count,
    active: view === value,
    href: buildAdminUrl(BASE, { view: value }),
  });

  const highlighted = highlight ? issues.find((issue) => issue.id === highlight) : undefined;

  return (
    <Column gap="$lg">
      <PageHeader
        title="Issues"
        description="Problems buyers have reported. Oldest first; decisions are made on the order page."
      />

      <FilterChips
        options={[
          chip("open", "Needs a decision", counts.open + counts.underReview),
          chip("under-review", "Under review", counts.underReview),
          chip("resolved", "Resolved", counts.resolved),
          chip("all", "All"),
        ]}
      />

      {highlight && !highlighted && (
        <Notice tone="info">That issue isn&apos;t in this view. Try &quot;All&quot;.</Notice>
      )}

      <AdminTable
        rows={issues}
        rowKey={(issue) => issue.id}
        emptyText={view === "open" ? "Nothing waiting. Nice." : "No issues in this view."}
        columns={[
          {
            key: "order",
            label: "Order",
            width: 110,
            render: (issue) => (
              <CellLink href={`/admin/orders/${issue.orderId}`}>{shortId(issue.orderId)}</CellLink>
            ),
          },
          {
            key: "item",
            label: "Item",
            flex: 2,
            render: (issue) => (
              <Column gap={0}>
                <CellText>{issue.productTitle}</CellText>
                <CellText secondary>
                  {issue.reporter} ← {issue.seller} · {gbp(issue.amountTotal)}
                </CellText>
              </Column>
            ),
          },
          {
            key: "reason",
            label: "Reason",
            width: 150,
            render: (issue) => <CellText>{issue.reason.replace(/_/g, " ")}</CellText>,
          },
          {
            key: "status",
            label: "Status",
            width: 200,
            render: (issue) => (
              <Row gap="$xs" flexWrap="wrap">
                <StatusBadge value={issue.status} />
                {issue.resolution && <StatusBadge value={issue.resolution} />}
              </Row>
            ),
          },
          {
            key: "hold",
            label: "Payout",
            width: 150,
            render: (issue) => <StatusBadge value={issue.paymentHoldStatus} />,
          },
          {
            key: "age",
            label: view === "resolved" ? "Resolved" : "Opened",
            width: 170,
            render: (issue) =>
              issue.status === "RESOLVED" && issue.resolvedAt ? (
                <CellText secondary>
                  {formatWhen(issue.resolvedAt)}
                  {issue.resolvedBy ? ` · ${issue.resolvedBy}` : ""}
                </CellText>
              ) : (
                <Column gap={0}>
                  <CellText secondary>{formatWhen(issue.createdAt)}</CellText>
                  <Text
                    size="$3"
                    color={ageInDays(issue.createdAt) >= 3 ? "$error" : "$textSecondary"}
                  >
                    {ageInDays(issue.createdAt)}d old
                  </Text>
                </Column>
              ),
          },
        ]}
      />

      <UrlPagination
        basePath={BASE}
        params={params}
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </Column>
  );
}
