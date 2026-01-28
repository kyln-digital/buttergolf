"use client";

import { ConnectBalances, ConnectPayouts, ConnectPayoutsList } from "@stripe/react-connect-js";
import { Column, Heading, Text, Card } from "@buttergolf/ui";

/**
 * Seller Payouts Page
 *
 * Displays Stripe Connect payout components:
 * - ConnectBalances: View available/pending balance, add funds
 * - ConnectPayouts: Manage payout schedule and destination
 * - ConnectPayoutsList: View payout history
 *
 * This is recommended for Fully Embedded Connect integrations
 * to allow sellers to manage their payouts and avoid negative balances.
 */
export default function SellerPayoutsPage() {
  return (
    <Column gap="$xl" fullWidth>
      <Column gap="$xs">
        <Heading level={2}>Payouts</Heading>
        <Text color="$textSecondary">
          View your balance, manage payout schedule, and see payout history
        </Text>
      </Column>

      {/* Balance Section */}
      <Card variant="elevated" padding="$lg">
        <Column gap="$md">
          <Heading level={3}>Balance</Heading>
          <ConnectBalances />
        </Column>
      </Card>

      {/* Payout Settings */}
      <Card variant="elevated" padding="$lg">
        <Column gap="$md">
          <Heading level={3}>Payout Settings</Heading>
          <ConnectPayouts />
        </Column>
      </Card>

      {/* Payout History */}
      <Card variant="elevated" padding="$lg">
        <Column gap="$md">
          <Heading level={3}>Payout History</Heading>
          <ConnectPayoutsList />
        </Column>
      </Card>
    </Column>
  );
}
