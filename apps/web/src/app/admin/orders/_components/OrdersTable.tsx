"use client";

import { Column, Row } from "@buttergolf/ui";
import { buildAdminUrl, type QueryParams } from "@/lib/admin-url";
import {
  AdminTable,
  CellLink,
  CellText,
  FilterChips,
  PageHeader,
  SearchForm,
  StatusBadge,
  UrlPagination,
} from "../../_components/AdminUi";
import { formatDay, fullName, gbp, shortId } from "../../_components/targets";

export interface OrderRow {
  id: string;
  createdAt: string;
  amountTotal: number;
  status: string;
  paymentHoldStatus: string;
  shipmentStatus: string;
  labelError: string | null;
  productTitle: string;
  buyer: { id: string; firstName: string; lastName: string };
  seller: { id: string; firstName: string; lastName: string };
  issueStatus: string | null;
}

interface Filters extends QueryParams {
  q?: string;
  status?: string;
  hold?: string;
  queue?: string;
}

const BASE = "/admin/orders";

export function OrdersTable({
  orders,
  filters,
  page,
  totalPages,
  total,
}: {
  orders: OrderRow[];
  filters: Filters;
  page: number;
  totalPages: number;
  total: number;
}) {
  const chip = (patch: Partial<Filters>, label: string, active: boolean) => ({
    label,
    active,
    href: buildAdminUrl(BASE, { ...filters, ...patch, page: undefined }),
  });

  return (
    <Column gap="$lg">
      <PageHeader
        title="Orders"
        description="Search by order id, Stripe payment / charge / transfer id, buyer or seller email, or item title."
      />

      <SearchForm
        basePath={BASE}
        params={filters}
        initialValue={filters.q}
        placeholder="Search orders"
      />

      <Column gap="$sm">
        <FilterChips
          options={[
            chip({ queue: undefined }, "All", !filters.queue),
            chip({ queue: "issues" }, "Open issues", filters.queue === "issues"),
            chip({ queue: "disputed" }, "Payout frozen", filters.queue === "disputed"),
            chip({ queue: "stuck-payouts" }, "Stuck payouts", filters.queue === "stuck-payouts"),
            chip({ queue: "label-failures" }, "Label failures", filters.queue === "label-failures"),
            chip({ queue: "unshipped" }, "Unshipped > 5 days", filters.queue === "unshipped"),
          ]}
        />
        <FilterChips
          options={[
            chip({ status: undefined }, "Any status", !filters.status),
            ...[
              "PAYMENT_CONFIRMED",
              "LABEL_GENERATED",
              "SHIPPED",
              "DELIVERED",
              "CANCELLED",
              "REFUNDED",
            ].map((status) =>
              chip({ status }, status.replace(/_/g, " "), filters.status === status)
            ),
          ]}
        />
        <FilterChips
          options={[
            chip({ hold: undefined }, "Any payout state", !filters.hold),
            ...["HELD", "PENDING_SELLER_ONBOARDING", "DISPUTED", "RELEASED", "REFUNDED"].map(
              (hold) => chip({ hold }, hold.replace(/_/g, " "), filters.hold === hold)
            ),
          ]}
        />
      </Column>

      <AdminTable
        rows={orders}
        rowKey={(order) => order.id}
        emptyText="No orders match."
        columns={[
          {
            key: "id",
            label: "Order",
            width: 110,
            render: (order) => (
              <CellLink href={`/admin/orders/${order.id}`}>{shortId(order.id)}</CellLink>
            ),
          },
          {
            key: "item",
            label: "Item",
            flex: 2,
            render: (order) => (
              <Column gap={0}>
                <CellText>{order.productTitle}</CellText>
                <CellText secondary>
                  {fullName(order.buyer)} ← {fullName(order.seller)}
                </CellText>
              </Column>
            ),
          },
          {
            key: "total",
            label: "Total",
            width: 90,
            render: (order) => <CellText>{gbp(order.amountTotal)}</CellText>,
          },
          {
            key: "status",
            label: "Status",
            width: 150,
            render: (order) => <StatusBadge value={order.status} />,
          },
          {
            key: "shipment",
            label: "Shipment",
            width: 140,
            render: (order) => (
              <Column gap={0}>
                <StatusBadge value={order.shipmentStatus} />
                {order.labelError && <CellText secondary>Label failed</CellText>}
              </Column>
            ),
          },
          {
            key: "hold",
            label: "Payout",
            width: 170,
            render: (order) => (
              <Row gap="$xs" flexWrap="wrap">
                <StatusBadge value={order.paymentHoldStatus} />
                {order.issueStatus && order.issueStatus !== "RESOLVED" && (
                  <StatusBadge value="ISSUE" />
                )}
              </Row>
            ),
          },
          {
            key: "when",
            label: "Placed",
            width: 110,
            render: (order) => <CellText secondary>{formatDay(order.createdAt)}</CellText>,
          },
        ]}
      />

      <UrlPagination
        basePath={BASE}
        params={filters}
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </Column>
  );
}
