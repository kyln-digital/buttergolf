"use client";

import { useCallback, useEffect, useState } from "react";
import type { PayoutStatus } from "@buttergolf/constants";
import { formatCurrencyFromPence } from "@buttergolf/app";
import { Badge, Button, Card, Column, Heading, Row, Spinner, Text, View } from "@buttergolf/ui";
import { usePayoutStatus } from "@/hooks/usePayoutStatus";
import { useLinkPress } from "@/hooks/useLinkPress";
import { PayoutSetup } from "@/components/payouts/PayoutSetup";

// ---------------------------------------------------------------------------
// Payout history data
// ---------------------------------------------------------------------------

interface PayoutRow {
  id: string;
  amountPence: number;
  currency: string;
  status: string;
  arrivalDate: string;
  createdAt: string;
  destinationLast4: string | null;
  failureMessage: string | null;
}

interface PayoutsResponse {
  hasAccount: boolean;
  currency: string;
  balance: { availablePence: number; pendingPence: number } | null;
  payouts: PayoutRow[];
}

function usePayoutHistory(enabled: boolean) {
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/connect/payouts", { credentials: "include" });
      if (!response.ok) throw new Error("We couldn't load your balance and payouts");
      setData((await response.json()) as PayoutsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load your balance and payouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return { data, loading, error, reload: load };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

type BadgeVariant = "success" | "info" | "error" | "neutral";
type BadgeTextColor = "$success" | "$info" | "$error" | "$textSecondary";

interface PayoutStateStyle {
  label: string;
  variant: BadgeVariant;
  color: BadgeTextColor;
}

const PAYOUT_STATE: Record<string, PayoutStateStyle> = {
  paid: { label: "Paid", variant: "success", color: "$success" },
  pending: { label: "Pending", variant: "info", color: "$info" },
  in_transit: { label: "On its way", variant: "info", color: "$info" },
  failed: { label: "Failed", variant: "error", color: "$error" },
  canceled: { label: "Cancelled", variant: "error", color: "$error" },
};

function payoutState(state: string): PayoutStateStyle {
  return (
    PAYOUT_STATE[state] ?? {
      label: state.replace(/_/g, " "),
      variant: "neutral",
      color: "$textSecondary",
    }
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type EditingSection = "details" | "bank" | null;

/**
 * Seller Payouts — the seller's money page.
 *
 * Everything here is rendered by ButterGolf: balance, bank account, review
 * state and payout history all come from our own JSON routes, and any editing
 * happens in our own payout setup flow.
 */
export default function SellerPayoutsPage() {
  const { status, loading, error, refresh } = usePayoutStatus();
  const [editing, setEditing] = useState<EditingSection>(null);

  const needsSetup = status
    ? !status.hasAccount ||
      status.needsDetails ||
      status.needsBankAccount ||
      status.needsVerification
    : false;

  const history = usePayoutHistory(Boolean(status) && !needsSetup);

  const reloadHistory = history.reload;
  const handleComplete = useCallback(() => {
    setEditing(null);
    void refresh();
    void reloadHistory();
  }, [refresh, reloadHistory]);

  const stopEditing = useCallback(() => setEditing(null), []);

  if (loading) {
    return (
      <Column fullWidth alignItems="center" justifyContent="center" minHeight={320} gap="$md">
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary">Loading your payouts...</Text>
      </Column>
    );
  }

  if (error || !status) {
    return (
      <Column fullWidth alignItems="center" justifyContent="center" minHeight={320} gap="$md">
        <Text color="$error">{error ?? "We couldn't load your payout details"}</Text>
        <Button butterVariant="secondary" size="$4" onPress={() => void refresh()}>
          Try again
        </Button>
      </Column>
    );
  }

  if (needsSetup) {
    return (
      <Column gap="$xl" fullWidth>
        <PageHeading />
        <Card variant="outlined" padding="$lg">
          <Column gap="$xs">
            <Heading level={3} size="$5">
              Get paid for your sales
            </Heading>
            <Text color="$textSecondary">
              Tell us who you are and where to send your money. It takes a couple of minutes, and
              once it&apos;s done every sale is paid out to your bank automatically.
            </Text>
          </Column>
        </Card>
        <PayoutSetup initialStatus={status} onComplete={handleComplete} />
      </Column>
    );
  }

  return (
    <Column gap="$xl" fullWidth>
      <PageHeading />

      <BalanceCard balance={history.data?.balance ?? null} loading={history.loading} />

      <BankAccountCard
        status={status}
        editing={editing === "bank"}
        onEdit={() => setEditing("bank")}
        onComplete={handleComplete}
        onExit={stopEditing}
      />

      <ReviewCard
        status={status}
        editing={editing === "details"}
        onEdit={() => setEditing("details")}
        onComplete={handleComplete}
        onExit={stopEditing}
      />

      <HistoryCard history={history} />
    </Column>
  );
}

function PageHeading() {
  return (
    <Column gap="$xs">
      <Heading level={2}>Payouts</Heading>
      <Text color="$textSecondary">
        Your balance, your bank account, and every payout we&apos;ve sent
      </Text>
    </Column>
  );
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

function BalanceCard({
  balance,
  loading,
}: {
  balance: { availablePence: number; pendingPence: number } | null;
  loading: boolean;
}) {
  return (
    <Card variant="outlined" padding="$lg">
      <Column gap="$md">
        <Heading level={3} size="$5">
          Balance
        </Heading>

        {loading && !balance ? (
          <Spinner size="md" color="$primary" />
        ) : (
          <Row gap="$2xl" flexWrap="wrap">
            <Column gap="$xs">
              <Text size="$3" color="$textSecondary">
                Available
              </Text>
              <Text size="$8" fontWeight="bold">
                {formatCurrencyFromPence(balance?.availablePence ?? 0)}
              </Text>
            </Column>
            <Column gap="$xs">
              <Text size="$3" color="$textSecondary">
                Pending
              </Text>
              <Text size="$8" fontWeight="bold" color="$textSecondary">
                {formatCurrencyFromPence(balance?.pendingPence ?? 0)}
              </Text>
            </Column>
          </Row>
        )}

        <Text size="$4" color="$textSecondary">
          Payouts are sent to your bank automatically, usually the next working day.
        </Text>
      </Column>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bank account
// ---------------------------------------------------------------------------

function BankAccountCard({
  status,
  editing,
  onEdit,
  onComplete,
  onExit,
}: {
  status: PayoutStatus;
  editing: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const bank = status.bankAccount;

  return (
    <Card variant="outlined" padding="$lg">
      <Column gap="$md">
        <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
          <Heading level={3} size="$5">
            Bank account
          </Heading>
          {!editing && (
            <Button butterVariant="secondary" size="$3" onPress={onEdit}>
              Change bank account
            </Button>
          )}
        </Row>

        {editing ? (
          <PayoutSetup
            initialStatus={status}
            initialStep="bank"
            onComplete={onComplete}
            onExit={onExit}
          />
        ) : bank ? (
          <Column gap="$xs">
            <Text size="$6" fontWeight="600">
              {bank.bankName ?? "Bank account"}
            </Text>
            <Text color="$textSecondary">•••• {bank.last4}</Text>
            {bank.sortCode && <Text color="$textSecondary">Sort code {bank.sortCode}</Text>}
            {bank.accountHolderName && <Text color="$textSecondary">{bank.accountHolderName}</Text>}
          </Column>
        ) : (
          <Text color="$textSecondary">We don&apos;t have a bank account for you yet.</Text>
        )}
      </Column>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Review / restricted / rejected
// ---------------------------------------------------------------------------

function ReviewCard({
  status,
  editing,
  onEdit,
  onComplete,
  onExit,
}: {
  status: PayoutStatus;
  editing: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const linkPress = useLinkPress();
  const isRejected = status.status === "rejected";
  const isRestricted = status.status === "restricted";
  const isPending = status.requirements.pendingVerification.length > 0;

  if (!isRejected && !isRestricted && !isPending) return null;

  const tone = isRejected || isRestricted ? "$error" : "$warning";
  const background = isRejected || isRestricted ? "$errorLight" : "$warningLight";

  return (
    <View
      width="100%"
      backgroundColor={background}
      borderLeftWidth={4}
      borderLeftColor={tone}
      borderRadius="$lg"
      padding="$lg"
    >
      <Column gap="$md">
        <Heading level={3} size="$5" color={tone}>
          {isRejected
            ? "We can't pay out to this account"
            : isRestricted
              ? "Payouts are paused"
              : "We're checking your details"}
        </Heading>

        {isRejected && (
          <Text color="$textSecondary">
            Please contact support and we&apos;ll sort this out with you.
          </Text>
        )}

        {isRestricted && (
          <Column gap="$xs">
            <Text color="$textSecondary">
              Update the details below and we&apos;ll start paying you again.
            </Text>
            {status.requirements.errors.map((requirementError) => (
              <Text
                key={`${requirementError.requirement}-${requirementError.code}`}
                color="$textSecondary"
              >
                • {requirementError.reason}
              </Text>
            ))}
          </Column>
        )}

        {!isRejected && !isRestricted && isPending && (
          <Text color="$textSecondary">
            Payouts start automatically once that&apos;s done — there&apos;s nothing for you to do.
          </Text>
        )}

        {isRejected && (
          <Row>
            <Button
              butterVariant="primary"
              size="$4"
              tag="a"
              href="/help-centre"
              onPress={linkPress("/help-centre")}
            >
              Contact support
            </Button>
          </Row>
        )}

        {isRestricted &&
          (editing ? (
            <PayoutSetup
              initialStatus={status}
              initialStep="details"
              onComplete={onComplete}
              onExit={onExit}
            />
          ) : (
            <Row>
              <Button butterVariant="primary" size="$4" onPress={onEdit}>
                Update details
              </Button>
            </Row>
          ))}
      </Column>
    </View>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function HistoryCard({ history }: { history: ReturnType<typeof usePayoutHistory> }) {
  const payouts = history.data?.payouts ?? [];

  return (
    <Card variant="outlined" padding="$lg">
      <Column gap="$md">
        <Heading level={3} size="$5">
          Payout history
        </Heading>

        {history.loading && !history.data ? (
          <Spinner size="md" color="$primary" />
        ) : history.error ? (
          <Column gap="$sm" alignItems="flex-start">
            <Text color="$error">{history.error}</Text>
            <Button butterVariant="secondary" size="$3" onPress={() => void history.reload()}>
              Try again
            </Button>
          </Column>
        ) : payouts.length === 0 ? (
          <Text color="$textSecondary">
            No payouts yet. Your first payout arrives after your first completed sale.
          </Text>
        ) : (
          <Column gap="$sm">
            {payouts.map((payout) => {
              const state = payoutState(payout.status);
              return (
                <Column
                  key={payout.id}
                  gap="$xs"
                  paddingVertical="$sm"
                  borderBottomWidth={1}
                  borderBottomColor="$border"
                >
                  <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
                    <Column gap="$xs">
                      <Text fontWeight="600">{formatDate(payout.arrivalDate)}</Text>
                      {payout.destinationLast4 && (
                        <Text size="$3" color="$textSecondary">
                          To •••• {payout.destinationLast4}
                        </Text>
                      )}
                    </Column>
                    <Row alignItems="center" gap="$md">
                      <Text size="$6" fontWeight="600">
                        {formatCurrencyFromPence(payout.amountPence)}
                      </Text>
                      <Badge variant={state.variant} size="sm">
                        <Text size="$3" color={state.color} fontWeight="600">
                          {state.label}
                        </Text>
                      </Badge>
                    </Row>
                  </Row>
                  {payout.failureMessage && (
                    <Text size="$3" color="$error">
                      {payout.failureMessage}
                    </Text>
                  )}
                </Column>
              );
            })}
          </Column>
        )}
      </Column>
    </Card>
  );
}
