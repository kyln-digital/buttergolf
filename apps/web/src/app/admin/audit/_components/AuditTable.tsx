"use client";

import { Column, Text } from "@buttergolf/ui";
import { buildAdminUrl, type QueryParams } from "@/lib/admin-url";
import {
  AdminTable,
  CellLink,
  CellText,
  FilterChips,
  PageHeader,
  SearchForm,
  UrlPagination,
} from "../../_components/AdminUi";
import { formatWhen, shortId, targetHref } from "../../_components/targets";

export interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string | null;
  createdAt: string;
  actor: { id: string; name: string };
}

interface Filters extends QueryParams {
  q?: string;
  actor?: string;
  type?: string;
}

const BASE = "/admin/audit";
const TARGET_TYPES = ["user", "order", "issue", "product", "brand", "category", "clubModel"];

export function AuditTable({
  actions,
  actors,
  filters,
  page,
  totalPages,
  total,
}: {
  actions: AuditRow[];
  actors: { id: string; name: string }[];
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
        title="Audit log"
        description="Every change made through this portal, newest first. Search matches the action name or an exact target id."
      />

      <SearchForm
        basePath={BASE}
        params={filters}
        initialValue={filters.q}
        placeholder="e.g. order.refund"
      />

      <Column gap="$sm">
        <FilterChips
          options={[
            chip({ type: undefined }, "Any target", !filters.type),
            ...TARGET_TYPES.map((type) => chip({ type }, type, filters.type === type)),
          ]}
        />
        {actors.length > 0 && (
          <FilterChips
            options={[
              chip({ actor: undefined }, "Anyone", !filters.actor),
              ...actors.map((actor) =>
                chip(
                  { actor: actor.id },
                  actor.name || shortId(actor.id),
                  filters.actor === actor.id
                )
              ),
            ]}
          />
        )}
      </Column>

      <AdminTable
        rows={actions}
        rowKey={(entry) => entry.id}
        emptyText="No actions recorded."
        columns={[
          {
            key: "when",
            label: "When",
            width: 160,
            render: (entry) => <CellText secondary>{formatWhen(entry.createdAt)}</CellText>,
          },
          {
            key: "who",
            label: "Who",
            width: 160,
            render: (entry) => (
              <CellLink href={`/admin/users/${entry.actor.id}`}>{entry.actor.name}</CellLink>
            ),
          },
          {
            key: "action",
            label: "Action",
            width: 160,
            render: (entry) => <CellText>{entry.action}</CellText>,
          },
          {
            key: "target",
            label: "Target",
            width: 180,
            render: (entry) => {
              const href = targetHref(entry.targetType, entry.targetId);
              const label = `${entry.targetType} ${shortId(entry.targetId)}`;
              return href ? <CellLink href={href}>{label}</CellLink> : <CellText>{label}</CellText>;
            },
          },
          {
            key: "details",
            label: "Details",
            flex: 2,
            render: (entry) => (
              <Text size="$3" color="$textSecondary" numberOfLines={2} selectable>
                {entry.metadata ?? "—"}
              </Text>
            ),
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
