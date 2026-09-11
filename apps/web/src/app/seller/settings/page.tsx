"use client";

import { useCallback, useState } from "react";
import type { PayoutStatus } from "@buttergolf/constants";
import { Button, Card, Column, Heading, Row, Spinner, Text } from "@buttergolf/ui";
import { usePayoutStatus } from "@/hooks/usePayoutStatus";
import { PayoutSetup } from "@/components/payouts/PayoutSetup";

type EditingSection = "details" | "bank" | null;

/**
 * Seller Settings — the payout details ButterGolf holds on file.
 *
 * Shows what we have (name, address, mobile, bank account) and lets the seller
 * change any of it in our own payout setup flow, rendered inline.
 */
export default function SellerSettingsPage() {
  const { status, loading, error, refresh } = usePayoutStatus();
  const [editing, setEditing] = useState<EditingSection>(null);

  const handleComplete = useCallback(() => {
    setEditing(null);
    void refresh();
  }, [refresh]);

  const stopEditing = useCallback(() => setEditing(null), []);

  if (loading) {
    return (
      <Column fullWidth alignItems="center" justifyContent="center" minHeight={320} gap="$md">
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary">Loading your settings...</Text>
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

  if (!status.hasAccount) {
    return (
      <Column gap="$xl" fullWidth>
        <PageHeading />
        <Card variant="outlined" padding="$lg">
          <Column gap="$xs">
            <Heading level={3} size="$5">
              Get paid for your sales
            </Heading>
            <Text color="$textSecondary">
              Tell us who you are and where to send your money. Once it&apos;s done we&apos;ll keep
              the details here, and you can change them whenever you like.
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

      <Card variant="outlined" padding="$lg">
        <Column gap="$md">
          <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
            <Heading level={3} size="$5">
              Payout details
            </Heading>
            {editing !== "details" && (
              <Button butterVariant="secondary" size="$3" onPress={() => setEditing("details")}>
                Edit
              </Button>
            )}
          </Row>

          {editing === "details" ? (
            <PayoutSetup
              initialStatus={status}
              initialStep="details"
              onComplete={handleComplete}
              onExit={stopEditing}
            />
          ) : (
            <Column gap="$md">
              <DetailRow label="Name" value={formatName(status)} />
              <DetailRow label="Address" value={formatAddress(status)} />
              <DetailRow label="Mobile" value={status.prefill.phone ?? "Not provided"} />
            </Column>
          )}
        </Column>
      </Card>

      <Card variant="outlined" padding="$lg">
        <Column gap="$md">
          <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
            <Heading level={3} size="$5">
              Bank account
            </Heading>
            {editing !== "bank" && (
              <Button butterVariant="secondary" size="$3" onPress={() => setEditing("bank")}>
                Edit
              </Button>
            )}
          </Row>

          {editing === "bank" ? (
            <PayoutSetup
              initialStatus={status}
              initialStep="bank"
              onComplete={handleComplete}
              onExit={stopEditing}
            />
          ) : status.bankAccount ? (
            <Column gap="$md">
              <DetailRow
                label="Bank"
                value={`${status.bankAccount.bankName ?? "Bank account"} •••• ${status.bankAccount.last4}`}
              />
              <DetailRow label="Sort code" value={status.bankAccount.sortCode ?? "Not provided"} />
              <DetailRow
                label="Account holder"
                value={status.bankAccount.accountHolderName ?? "Not provided"}
              />
            </Column>
          ) : (
            <Text color="$textSecondary">
              We don&apos;t have a bank account for you yet. Add one so we can pay you.
            </Text>
          )}
        </Column>
      </Card>
    </Column>
  );
}

function PageHeading() {
  return (
    <Column gap="$xs">
      <Heading level={2}>Settings</Heading>
      <Text color="$textSecondary">The details we use to pay you for your sales</Text>
    </Column>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Column gap="$xs">
      <Text size="$3" color="$textSecondary">
        {label}
      </Text>
      <Text size="$5">{value}</Text>
    </Column>
  );
}

function formatName(status: PayoutStatus): string {
  const name = `${status.prefill.firstName} ${status.prefill.lastName}`.trim();
  return name || "Not provided";
}

function formatAddress(status: PayoutStatus): string {
  const address = status.prefill.address;
  if (!address) return "Not provided";
  return [address.line1, address.line2, address.city, address.postalCode]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
}
