"use client";

import { Button, Column, Row, Text } from "@buttergolf/ui";
import { Download } from "@tamagui/lucide-icons";
import { AdminTable, CellText, PageHeader, Section, StatCard } from "../../_components/AdminUi";
import { formatWhen } from "../../_components/targets";

interface SubscriberRow {
  id: string;
  email: string;
  source: string;
  createdAt: string;
}

function ExportButton({ kind, label }: { kind: "waitlist" | "newsletter"; label: string }) {
  return (
    <Button
      size="$3"
      butterVariant="secondary"
      icon={<Download size={14} />}
      onPress={() => {
        window.location.href = `/api/admin/export/${kind}`;
      }}
    >
      {label}
    </Button>
  );
}

const COLUMNS = [
  {
    key: "email",
    label: "Email",
    flex: 2,
    render: (row: SubscriberRow) => <CellText>{row.email}</CellText>,
  },
  {
    key: "source",
    label: "Source",
    width: 140,
    render: (row: SubscriberRow) => <CellText secondary>{row.source}</CellText>,
  },
  {
    key: "when",
    label: "Signed up",
    width: 170,
    render: (row: SubscriberRow) => <CellText secondary>{formatWhen(row.createdAt)}</CellText>,
  },
];

export function MarketingView({
  stats,
  waitlist,
  newsletter,
  canExport,
}: {
  stats: {
    waitlistTotal: number;
    waitlistWeek: number;
    newsletterTotal: number;
    newsletterWeek: number;
  };
  waitlist: SubscriberRow[];
  newsletter: SubscriberRow[];
  canExport: boolean;
}) {
  return (
    <Column gap="$lg">
      <PageHeader
        title="Marketing"
        description="Coming-soon waitlist and newsletter sign-ups. Exports are CSV, one row per email."
      />

      <Row gap="$md" flexWrap="wrap">
        <StatCard
          label="Waitlist"
          value={stats.waitlistTotal}
          hint={`${stats.waitlistWeek} in the last 7 days`}
        />
        <StatCard
          label="Newsletter"
          value={stats.newsletterTotal}
          hint={`${stats.newsletterWeek} in the last 7 days`}
        />
      </Row>

      {!canExport && (
        <Text size="$4" color="$textSecondary">
          Exports need an ADMIN.
        </Text>
      )}

      <Section
        title="Waitlist (latest 20)"
        actions={canExport ? <ExportButton kind="waitlist" label="Export all" /> : undefined}
      >
        <AdminTable
          rows={waitlist}
          rowKey={(row) => row.id}
          emptyText="Nobody yet."
          columns={COLUMNS}
        />
      </Section>

      <Section
        title="Newsletter (latest 20)"
        actions={canExport ? <ExportButton kind="newsletter" label="Export all" /> : undefined}
      >
        <AdminTable
          rows={newsletter}
          rowKey={(row) => row.id}
          emptyText="Nobody yet."
          columns={COLUMNS}
        />
      </Section>
    </Column>
  );
}
