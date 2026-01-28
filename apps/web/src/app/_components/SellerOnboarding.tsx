"use client";

import { useState, useEffect, useRef } from "react";
import { Column, Row, Heading, Text, Button, Card, Spinner } from "@buttergolf/ui";
import { ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StepChange } from "@stripe/connect-js";

interface SellerOnboardingProps {
  readonly onComplete?: () => void;
  readonly onExit?: () => void;
}

/**
 * Embedded Stripe Connect Onboarding Component
 *
 * This component handles the entire seller onboarding flow:
 * 1. Creates a Stripe Connect Express account
 * 2. Embeds the Stripe onboarding UI
 * 3. Handles completion and errors
 *
 * The embedded component is highly customizable via theming
 */
export function SellerOnboarding({ onComplete, onExit }: SellerOnboardingProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null);
  const hasReachedSummaryRef = useRef(false);

  useEffect(() => {
    initializeStripeConnect();
  }, []);

  async function initializeStripeConnect() {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch account session from our API
      const response = await fetch("/api/stripe/connect/account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create Connect account");
      }

      const { clientSecret } = await response.json();

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error("Stripe publishable key not configured");
      }

      // 2. Initialize Stripe Connect.js with the client secret
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => clientSecret,
        appearance: {
          variables: {
            colorPrimary: "#E25F2F", // Pure Butter orange
            colorBackground: "#FFFFFF", // Pure White
            colorText: "#1E1E1E", // Charcoal text
            colorDanger: "#dc2626", // Error red
            fontFamily: "system-ui, -apple-system, sans-serif",
            spacingUnit: "4px",
            borderRadius: "10px", // Softer radius
          },
        },
      });

      setStripeConnectInstance(instance);
    } catch (err) {
      console.error("Error initializing Stripe Connect:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize onboarding");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card variant="elevated" padding="$xl">
        <Column gap="$md" alignItems="center">
          <Spinner size="lg" color="$primary" />
          <Text color="$textSecondary">Initializing seller onboarding...</Text>
        </Column>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="elevated" padding="$xl">
        <Column gap="$lg">
          <Column gap="$sm">
            <Heading level={3} color="$error">
              Onboarding Error
            </Heading>
            <Text color="$textSecondary">{error}</Text>
          </Column>
          <Row gap="$md">
            <Button
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              onPress={() => initializeStripeConnect()}
            >
              Try Again
            </Button>
            {onExit && (
              <Button chromeless onPress={onExit}>
                Cancel
              </Button>
            )}
          </Row>
        </Column>
      </Card>
    );
  }

  if (!stripeConnectInstance) {
    return (
      <Card variant="elevated" padding="$xl">
        <Text color="$error">Failed to load Stripe Connect</Text>
      </Card>
    );
  }

  const handleStepChange = (stepChange: StepChange) => {
    hasReachedSummaryRef.current =
      stepChange.step === "summary" || stepChange.step.startsWith("summary_");
  };

  const handleExit = () => {
    if (hasReachedSummaryRef.current) {
      onComplete?.();
    }
    onExit?.();
    hasReachedSummaryRef.current = false;
  };

  return (
    <Column gap="$lg" fullWidth>
      <Column gap="$sm">
        <Heading level={2}>Become a Seller</Heading>
        <Text color="$textSecondary">
          Complete the onboarding process to start selling golf equipment on ButterGolf. This should
          only take a few minutes.
        </Text>
      </Column>

      <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
        <ConnectAccountOnboarding
          onExit={handleExit}
          onStepChange={handleStepChange}
          // CollectionOptions determine what information to collect
          // collectionOptions={{
          //   fields: 'eventually_due', // Collect all eventually_due requirements
          //   futureRequirements: 'include', // Include future requirements
          // }}
        />
      </ConnectComponentsProvider>

      {onExit && (
        <Row justifyContent="center">
          <Button chromeless onPress={onExit}>
            Save and Exit
          </Button>
        </Row>
      )}
    </Column>
  );
}
