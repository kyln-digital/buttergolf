"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Column, Heading, Input, Row, Text, View } from "@buttergolf/ui";
import type { ColorTokens } from "tamagui";
import { Search } from "@tamagui/lucide-icons";
import { Pagination } from "@/components/Pagination";
import { buildAdminUrl, type QueryParams } from "@/lib/admin-url";

// ─── Page chrome ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Row alignItems="flex-start" justifyContent="space-between" gap="$md" flexWrap="wrap">
      <Column gap="$xs" flex={1} minWidth={240}>
        <Heading level={1} size="$8">
          {title}
        </Heading>
        {description && (
          <Text size="$4" color="$textSecondary">
            {description}
          </Text>
        )}
      </Column>
      {actions && (
        <Row gap="$sm" alignItems="center" flexWrap="wrap">
          {actions}
        </Row>
      )}
    </Row>
  );
}

export type Tone = "neutral" | "success" | "warning" | "error" | "info";

const TONE_BG: Record<Tone, ColorTokens> = {
  neutral: "$surface",
  success: "$successLight",
  warning: "$warningLight",
  error: "$errorLight",
  info: "$infoLight",
};

const TONE_FG: Record<Tone, ColorTokens> = {
  neutral: "$text",
  success: "$success",
  warning: "$warning",
  error: "$error",
  info: "$info",
};

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <View
      backgroundColor={TONE_BG[tone]}
      borderRadius="$md"
      padding="$md"
      borderLeftWidth={4}
      borderLeftColor={TONE_FG[tone]}
    >
      <Text size="$4" color={tone === "neutral" ? "$text" : TONE_FG[tone]}>
        {children}
      </Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  href,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: Tone;
  hint?: string;
}) {
  const card = (
    <Card variant="outlined" padding="$md" borderRadius="$lg" flex={1} minWidth={180}>
      <Column gap="$xs">
        <Text size="$3" color="$textSecondary" fontWeight="600">
          {label.toUpperCase()}
        </Text>
        <Text size="$9" fontWeight="700" color={tone === "neutral" ? "$text" : TONE_FG[tone]}>
          {value}
        </Text>
        {hint && (
          <Text size="$3" color="$textSecondary">
            {hint}
          </Text>
        )}
      </Column>
    </Card>
  );
  if (!href) return card;
  return (
    <Link href={href} style={{ textDecoration: "none", display: "flex", flex: 1, minWidth: 180 }}>
      {card}
    </Link>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row gap="$md" alignItems="flex-start" flexWrap="wrap">
      <Text size="$3" color="$textSecondary" fontWeight="600" minWidth={150}>
        {label}
      </Text>
      <View flex={1} minWidth={200}>
        {typeof children === "string" || typeof children === "number" ? (
          <Text size="$4" color="$text" selectable>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </Row>
  );
}

export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" padding="$lg" borderRadius="$lg">
      <Column gap="$md">
        <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
          <Heading level={2} size="$6">
            {title}
          </Heading>
          {actions}
        </Row>
        {children}
      </Column>
    </Card>
  );
}

// ─── Status badges ───────────────────────────────────────────────────────────

type BadgeVariant = "primary" | "secondary" | "success" | "error" | "warning" | "info" | "neutral";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Order
  PAYMENT_CONFIRMED: "info",
  LABEL_GENERATED: "info",
  SHIPPED: "primary",
  DELIVERED: "success",
  CANCELLED: "neutral",
  REFUNDED: "error",
  // Hold
  HELD: "warning",
  PENDING_SELLER_ONBOARDING: "info",
  RELEASED: "success",
  DISPUTED: "error",
  // Shipment
  PENDING: "neutral",
  PRE_TRANSIT: "info",
  IN_TRANSIT: "primary",
  OUT_FOR_DELIVERY: "primary",
  RETURNED: "warning",
  FAILED: "error",
  // Issue
  OPEN: "error",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  // Role
  USER: "neutral",
  SUPPORT: "info",
  ADMIN: "primary",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[value] ?? "neutral"} size="sm">
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── Lists ───────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  render: (row: T) => ReactNode;
}

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  emptyText = "Nothing here.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
}) {
  return (
    <View
      borderWidth={1}
      borderColor="$border"
      borderRadius="$lg"
      backgroundColor="$surface"
      overflow="hidden"
    >
      <View overflow="scroll">
        <Column minWidth={720}>
          <Row
            paddingHorizontal="$md"
            paddingVertical="$sm"
            backgroundColor="$background"
            borderBottomWidth={1}
            borderBottomColor="$border"
            gap="$md"
          >
            {columns.map((column) => (
              <View
                key={column.key}
                flex={column.width ? undefined : (column.flex ?? 1)}
                width={column.width}
              >
                <Text size="$2" color="$textSecondary" fontWeight="600">
                  {column.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </Row>
          {rows.length === 0 ? (
            <View padding="$lg">
              <Text size="$4" color="$textSecondary">
                {emptyText}
              </Text>
            </View>
          ) : (
            rows.map((row) => (
              <Row
                key={rowKey(row)}
                paddingHorizontal="$md"
                paddingVertical="$sm"
                borderBottomWidth={1}
                borderBottomColor="$border"
                gap="$md"
                alignItems="center"
                hoverStyle={{ backgroundColor: "$backgroundHover" }}
              >
                {columns.map((column) => (
                  <View
                    key={column.key}
                    flex={column.width ? undefined : (column.flex ?? 1)}
                    width={column.width}
                    minWidth={0}
                  >
                    {column.render(row)}
                  </View>
                ))}
              </Row>
            ))
          )}
        </Column>
      </View>
    </View>
  );
}

export function CellText({ children, secondary }: { children: ReactNode; secondary?: boolean }) {
  return (
    <Text
      size={secondary ? "$3" : "$4"}
      color={secondary ? "$textSecondary" : "$text"}
      numberOfLines={1}
      selectable
    >
      {children}
    </Text>
  );
}

export function CellLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <Text size="$4" color="$primary" fontWeight="600" numberOfLines={1}>
        {children}
      </Text>
    </Link>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ChipOption {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

export function FilterChips({ options }: { options: ChipOption[] }) {
  return (
    <Row gap="$xs" flexWrap="wrap">
      {options.map((option) => (
        <Link
          key={option.href + option.label}
          href={option.href}
          style={{ textDecoration: "none" }}
        >
          <Button
            size="$3"
            borderRadius="$full"
            butterVariant={option.active ? "primary" : "secondary"}
          >
            {option.count === undefined ? option.label : `${option.label} (${option.count})`}
          </Button>
        </Link>
      ))}
    </Row>
  );
}

/**
 * Search box that writes `q` into the current list URL (resetting the page).
 */
export function SearchForm({
  basePath,
  params,
  initialValue,
  placeholder,
}: {
  basePath: string;
  params: QueryParams;
  initialValue?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");

  const submit = () => {
    router.push(
      buildAdminUrl(basePath, { ...params, q: value.trim() || undefined, page: undefined })
    );
  };

  return (
    <Row gap="$sm" alignItems="center" flexWrap="wrap">
      <Input
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        onSubmitEditing={submit}
        minWidth={280}
        flex={1}
        size="$4"
      />
      <Button size="$4" butterVariant="secondary" icon={<Search size={16} />} onPress={submit}>
        Search
      </Button>
      {initialValue && (
        <Link
          href={buildAdminUrl(basePath, { ...params, q: undefined, page: undefined })}
          style={{ textDecoration: "none" }}
        >
          <Button size="$4" butterVariant="ghost">
            Clear
          </Button>
        </Link>
      )}
    </Row>
  );
}

export function UrlPagination({
  basePath,
  params,
  page,
  totalPages,
  total,
}: {
  basePath: string;
  params: QueryParams;
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  return (
    <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
      <Text size="$3" color="$textSecondary">
        {total} result{total === 1 ? "" : "s"}
      </Text>
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(next) => router.push(buildAdminUrl(basePath, { ...params, page: next }))}
        />
      )}
    </Row>
  );
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Button that runs an async action and shows its error underneath. `confirm`
 * is asked before running, for anything that moves money or hides things.
 */
export function ActionButton({
  label,
  busyLabel,
  onRun,
  confirm: confirmText,
  variant = "secondary",
  disabled,
  tone,
}: {
  label: string;
  busyLabel?: string;
  onRun: () => Promise<string | null>;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  tone?: "error";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const result = await onRun();
    if (result) setError(result);
    setBusy(false);
  };

  return (
    <Column gap="$xs">
      <Button
        size="$4"
        butterVariant={variant}
        onPress={handle}
        disabled={disabled || busy}
        opacity={disabled || busy ? 0.6 : 1}
        color={tone === "error" && variant !== "primary" ? "$error" : undefined}
      >
        {busy ? (busyLabel ?? "Working...") : label}
      </Button>
      {error && (
        <Text size="$3" color="$error">
          {error}
        </Text>
      )}
    </Column>
  );
}
