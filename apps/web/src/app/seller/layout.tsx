"use client";

import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import { ConnectNotificationBanner } from "@stripe/react-connect-js";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { usePathname } from "next/navigation";
import { Column, Row, Text, Heading, Spinner, Button, Card } from "@buttergolf/ui";
import { SellerDashboardNav } from "./_components/SellerDashboardNav";
import { useLinkPress } from "@/hooks/useLinkPress";

const STRIPE_EMBEDDED_ROUTES = [
  "/seller/payments",
  "/seller/payouts",
  "/seller/documents",
  "/seller/settings",
];

function SetupCallout() {
  const linkPress = useLinkPress();
  return (
    <Card variant="outlined" padding="$md">
      <Column gap="$sm" alignItems="center">
        <Heading level={2} size="$6" textAlign="center">
          Start selling on ButterGolf
        </Heading>
        <Text color="$textSecondary" textAlign="center">
          Finish setting up your account to unlock payments, payouts, and more.
        </Text>
        <Button
          butterVariant="primary"
          size="$4"
          tag="a"
          href="/account"
          onPress={linkPress("/account")}
        >
          Get started
        </Button>
      </Column>
    </Card>
  );
}

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
  const linkPress = useLinkPress();
  const pathname = usePathname();
  const { stripeConnectInstance, loading, error, hasAccount } = useStripeConnect();
  const isStripeEmbeddedRoute = STRIPE_EMBEDDED_ROUTES.some((r) => pathname?.startsWith(r));

  // Loading state
  if (loading) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" gap="$md">
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary">Loading seller dashboard...</Text>
      </Column>
    );
  }

  // Error state blocks Stripe-only routes. Core seller routes remain usable.
  if (error && isStripeEmbeddedRoute) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" padding="$xl">
        <Card variant="outlined" padding="$xl" maxWidth={500} borderRadius="$lg">
          <Column gap="$lg" alignItems="center">
            <Heading level={2} size="$6" color="$text">
              Unable to load dashboard
            </Heading>
            <Text color="$textSecondary" textAlign="center">
              {error}
            </Text>
            <Button
              butterVariant="primary"
              size="$4"
              tag="a"
              href="/account"
              onPress={linkPress("/account")}
            >
              Go to account settings
            </Button>
          </Column>
        </Card>
      </Column>
    );
  }

  // No account state blocks Stripe-only routes.
  if (!hasAccount && isStripeEmbeddedRoute) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" padding="$xl">
        <Card variant="outlined" padding="$xl" maxWidth={500} borderRadius="$lg">
          <Column gap="$lg" alignItems="center">
            <Heading level={2} size="$6" textAlign="center">
              Start selling on ButterGolf
            </Heading>
            <Text color="$textSecondary" textAlign="center">
              Set up your seller account to access your dashboard and start listing golf equipment.
            </Text>
            <Button
              butterVariant="primary"
              size="$5"
              tag="a"
              href="/account"
              onPress={linkPress("/account")}
            >
              Get started
            </Button>
          </Column>
        </Card>
      </Column>
    );
  }

  // Missing Connect instance only blocks Stripe-only routes.
  if (!stripeConnectInstance && isStripeEmbeddedRoute) {
    return (
      <Column fullWidth minHeight="60vh" alignItems="center" justifyContent="center" gap="$md">
        <Text color="$textSecondary">Unable to initialize seller dashboard. Please try again.</Text>
        <Button
          butterVariant="primary"
          size="$4"
          tag="a"
          href="/account"
          onPress={linkPress("/account")}
        >
          Go to account settings
        </Button>
      </Column>
    );
  }

  // Stripe pages: render with Connect provider so embedded components work.
  if (isStripeEmbeddedRoute && stripeConnectInstance) {
    return (
      <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
        <Column fullWidth minHeight="calc(100vh - 80px)">
          <ConnectNotificationBanner />

          <Row fullWidth flex={1}>
            <SellerDashboardNav />

            <Column flex={1} padding="$lg" backgroundColor="$background">
              {children}
            </Column>
          </Row>
        </Column>
      </ConnectComponentsProvider>
    );
  }

  // Core seller routes (dashboard, sales, listings) remain accessible without Connect setup.
  return (
    <Column fullWidth minHeight="calc(100vh - 80px)">
      <Row fullWidth flex={1}>
        <SellerDashboardNav />

        <Column flex={1} padding="$lg" backgroundColor="$background" gap="$md">
          {!hasAccount && <SetupCallout />}
          {error && !isStripeEmbeddedRoute && (
            <Card variant="outlined" padding="$md">
              <Text color="$textSecondary">{error}</Text>
            </Card>
          )}
          {children}
        </Column>
      </Row>
    </Column>
  );
}
