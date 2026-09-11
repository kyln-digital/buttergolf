"use client";

import { Column, Row, Text } from "@buttergolf/ui";
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
import { formatDay, fullName } from "../../_components/targets";

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  suspendedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  stripeConnectId: string | null;
  stripeOnboardingComplete: boolean;
  _count: { products: number; ordersPurchased: number; ordersSold: number };
}

interface Filters extends QueryParams {
  q?: string;
  role?: string;
  flag?: string;
  seller?: string;
  sort?: string;
}

const BASE = "/admin/users";

function sellerLabel(user: UserRow): string {
  if (user.stripeOnboardingComplete) return "Onboarded";
  if (user.stripeConnectId) return "Pending";
  return "—";
}

export function UsersTable({
  users,
  filters,
  page,
  totalPages,
  total,
}: {
  users: UserRow[];
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
        title="Users"
        description="Search by name, email, user id, Clerk id or Stripe account id."
      />

      <SearchForm
        basePath={BASE}
        params={filters}
        initialValue={filters.q}
        placeholder="Search users"
      />

      <Column gap="$sm">
        <FilterChips
          options={[
            chip({ flag: undefined, role: undefined }, "Everyone", !filters.flag && !filters.role),
            chip({ flag: "suspended", role: undefined }, "Suspended", filters.flag === "suspended"),
            chip({ flag: "staff", role: undefined }, "Staff", filters.flag === "staff"),
            chip({ flag: "deleted", role: undefined }, "Deleted", filters.flag === "deleted"),
          ]}
        />
        <FilterChips
          options={[
            chip({ seller: undefined }, "Any seller status", !filters.seller),
            chip({ seller: "onboarded" }, "Payouts set up", filters.seller === "onboarded"),
            chip({ seller: "pending" }, "Payouts pending", filters.seller === "pending"),
            chip({ seller: "none" }, "Never sold", filters.seller === "none"),
          ]}
        />
        <FilterChips
          options={[
            chip({ sort: undefined }, "Newest first", !filters.sort || filters.sort === "newest"),
            chip({ sort: "oldest" }, "Oldest first", filters.sort === "oldest"),
            chip({ sort: "name" }, "By name", filters.sort === "name"),
          ]}
        />
      </Column>

      <AdminTable
        rows={users}
        rowKey={(user) => user.id}
        emptyText="No users match."
        columns={[
          {
            key: "name",
            label: "Name",
            flex: 2,
            render: (user) => (
              <Column gap={0}>
                <CellLink href={`/admin/users/${user.id}`}>{fullName(user)}</CellLink>
                <CellText secondary>{user.email}</CellText>
              </Column>
            ),
          },
          {
            key: "role",
            label: "Role",
            width: 110,
            render: (user) => <StatusBadge value={user.role} />,
          },
          {
            key: "flags",
            label: "Flags",
            width: 150,
            render: (user) => (
              <Row gap="$xs" flexWrap="wrap">
                {user.suspendedAt && <StatusBadge value="SUSPENDED" />}
                {user.isDeleted && <StatusBadge value="DELETED" />}
                {!user.suspendedAt && !user.isDeleted && <CellText secondary>—</CellText>}
              </Row>
            ),
          },
          {
            key: "seller",
            label: "Payouts",
            width: 110,
            render: (user) => <CellText>{sellerLabel(user)}</CellText>,
          },
          {
            key: "listings",
            label: "Listings",
            width: 90,
            render: (user) => <CellText>{user._count.products}</CellText>,
          },
          {
            key: "orders",
            label: "Bought / sold",
            width: 120,
            render: (user) => (
              <CellText>
                {user._count.ordersPurchased} / {user._count.ordersSold}
              </CellText>
            ),
          },
          {
            key: "joined",
            label: "Joined",
            width: 120,
            render: (user) => <CellText secondary>{formatDay(user.createdAt)}</CellText>,
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

      {total === 0 && filters.q && (
        <Text size="$3" color="$textSecondary">
          Tip: ids must match exactly; names and emails match anywhere.
        </Text>
      )}
    </Column>
  );
}
