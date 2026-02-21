"use client";

import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import { ConnectNotificationBanner } from "@stripe/react-connect-js";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { Column, Row, Text, Heading, Spinner, Button, Card } from "@buttergolf/ui";
import { SellerDashboardNav } from "./_components/SellerDashboardNav";
import Link from "next/link";

/**
 * Seller Dashboard Layout
 *
 * This layout wraps all seller pages (/seller/*) with:
 * 1. ConnectComponentsProvider - Provides Stripe Connect context
 * 2. ConnectNotificationBanner - Shows compliance/requirement alerts at top
 * 3. SellerDashboardNav - Sidebar navigation
 *
 * The layout handles three states:
 * - Loading: Shows spinner while initializing
 * - No Account: Prompts user to complete onboarding
 * - Has Account: Shows full dashboard with navigation
 */
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { stripeConnectInstance, loading, error, hasAccount } = useStripeConnect();

  // Loading state
  if (loading) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" gap="$md">
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary">Loading seller dashboard...</Text>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" padding="$xl">
        <Card variant="elevated" padding="$xl" maxWidth={500}>
          <Column gap="$lg" alignItems="center">
            <Heading level={3} color="$error">
              Unable to Load Dashboard
            </Heading>
            <Text color="$textSecondary" textAlign="center">
              {error}
            </Text>
            <Link href="/account" style={{ textDecoration: "none" }}>
              <Button butterVariant="primary" size="$4">
                Go to Account Settings
              </Button>
            </Link>
          </Column>
        </Card>
      </Column>
    );
  }

  // No account state - prompt to complete onboarding
  if (!hasAccount) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" padding="$xl">
        <Card variant="elevated" padding="$xl" maxWidth={500}>
          <Column gap="$lg" alignItems="center">
            <Heading level={2}>Start Selling on ButterGolf</Heading>
            <Text color="$textSecondary" textAlign="center">
              Complete your seller onboarding to access your dashboard and start listing golf
              equipment.
            </Text>
            <Link href="/account" style={{ textDecoration: "none" }}>
              <Button butterVariant="primary" size="$5">
                Complete Seller Setup
              </Button>
            </Link>
          </Column>
        </Card>
      </Column>
    );
  }

  // No Connect instance (shouldn't happen if hasAccount is true, but safety check)
  if (!stripeConnectInstance) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" gap="$md">
        <Text color="$textSecondary">Unable to initialize seller dashboard. Please try again.</Text>
        <Link href="/account" style={{ textDecoration: "none" }}>
          <Button butterVariant="primary" size="$4">
            Go to Account Settings
          </Button>
        </Link>
      </Column>
    );
  }

  // Main dashboard layout
  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <Column fullWidth minHeight="calc(100vh - 80px)">
        {/* Notification Banner - shows compliance alerts at top */}
        <ConnectNotificationBanner />

        <Row fullWidth flex={1}>
          {/* Sidebar Navigation */}
          <SellerDashboardNav />

          {/* Main Content Area */}
          <Column flex={1} padding="$lg" backgroundColor="$background">
            {children}
          </Column>
        </Row>
      </Column>
    </ConnectComponentsProvider>
  );
}
