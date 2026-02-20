"use client";

import { useState, useEffect, useRef } from "react";
import { Column, Row, Heading, Text, Button, Card, Spinner } from "@buttergolf/ui";
import { CheckCircle, Lock, Banknote, Sparkles } from "@tamagui/lucide-icons";
import { brandColors } from "@buttergolf/config";
import { ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StepChange, StripeConnectInstance } from "@stripe/connect-js";
import { PhoneCollectionStep } from "../../sell/_components/PhoneCollectionStep";

interface PayoutStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  accountStatus: string | null;
  requirementsCount: number;
  phone: string | null;
}

type WizardStep = "phone" | "stripe" | "complete";

interface PayoutSetupWizardProps {
  /** Initial payout status from server */
  readonly initialStatus: PayoutStatus;
  /** Called when setup is complete */
  readonly onComplete?: () => void;
  /** Called when user exits/cancels */
  readonly onExit?: () => void;
}

/**
 * PayoutSetupWizard - Handles seller payout setup (phone + Stripe Connect)
 *
 * This component is used in Account Settings to set up seller payouts.
 * It's separate from the sell flow - users can list items without completing this.
 * Funds from sales are held until this setup is complete.
 *
 * Wizard flow:
 * - Step 1 (phone): Collect UK mobile (skip if already have it)
 * - Step 2 (stripe): Stripe embedded onboarding (with phone pre-filled if provided)
 * - Step 3 (complete): Show success message
 */
export function PayoutSetupWizard({ initialStatus, onComplete, onExit }: PayoutSetupWizardProps) {
  const [status, setStatus] = useState<PayoutStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(
    null
  );
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const hasReachedSummaryRef = useRef(false);

  // Determine current wizard step
  const isComplete =
    status.hasAccount && status.onboardingComplete && status.accountStatus === "active";

  const needsPhoneCollection = !status.phone && !status.hasAccount;

  const getCurrentStep = (): WizardStep => {
    if (isComplete) return "complete";
    if (needsPhoneCollection) return "phone";
    return "stripe";
  };

  const [wizardStep, setWizardStep] = useState<WizardStep>(getCurrentStep);

  // Sync wizardStep when status changes (e.g., from server refresh)
  useEffect(() => {
    const newStep = getCurrentStep();
    if (newStep !== wizardStep) {
      setWizardStep(newStep);
    }
  }, [status.hasAccount, status.onboardingComplete, status.accountStatus, status.phone]);

  // Auto-initialize Stripe onboarding when in stripe step
  useEffect(() => {
    if (wizardStep === "stripe" && !stripeConnectInstance && !loading) {
      initializeOnboarding();
    }
  }, [wizardStep]);

  async function handlePhoneSubmit(phone: string) {
    try {
      setPhoneSubmitting(true);
      setError(null);

      // Save phone to user profile
      const response = await fetch("/api/user/phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save phone number");
      }

      // Update local status and move to next step
      setStatus((prev) => ({ ...prev, phone }));
      setWizardStep("stripe");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save phone number");
    } finally {
      setPhoneSubmitting(false);
    }
  }

  function handlePhoneSkip() {
    // Move to Stripe onboarding without phone - Stripe will collect it
    setWizardStep("stripe");
  }

  async function initializeOnboarding() {
    try {
      setLoading(true);
      setError(null);

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error("Stripe publishable key not configured");
      }

      // Initialize Stripe Connect.js with ButterGolf branding
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          const response = await fetch("/api/stripe/connect/account", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({}),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to initialize onboarding");
          }

          const { clientSecret } = await response.json();
          return clientSecret;
        },
        appearance: {
          variables: {
            colorPrimary: brandColors.spicedClementine,
            colorBackground: brandColors.pureWhite,
            colorText: brandColors.ironstone,
            colorDanger: brandColors.error,
            fontFamily: "system-ui, -apple-system, sans-serif",
            spacingUnit: "12px",
            borderRadius: "10px",
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

  function handleStepChange(stepChange: StepChange) {
    if (stepChange.step === "summary" || stepChange.step.startsWith("summary_")) {
      hasReachedSummaryRef.current = true;
    }
  }

  async function handleOnboardingExit() {
    // Refresh status from server to check if onboarding is complete
    try {
      const response = await fetch("/api/stripe/connect/account", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const newStatus = {
          ...status,
          hasAccount: data.hasAccount,
          onboardingComplete: data.onboardingComplete ?? false,
          accountStatus: data.chargesEnabled ? "active" : "pending",
          requirementsCount: data.requirements?.currently_due?.length ?? 0,
        };
        setStatus(newStatus);

        // If complete, notify parent
        if (data.onboardingComplete && data.chargesEnabled) {
          onComplete?.();
        }
      }
    } catch {
      // Silent fail - user can try again
    }
    hasReachedSummaryRef.current = false;
  }

  // Setup is complete
  if (isComplete) {
    return (
      <Column gap="$lg" alignItems="center" padding="$xl">
        <CheckCircle size={40} color="$success" />
        <Heading level={2} textAlign="center">
          Payout Setup Complete!
        </Heading>
        <Text color="$textSecondary" textAlign="center" size="$5">
          You&apos;re all set to receive payments. When you make a sale, funds will be transferred
          to your bank account.
        </Text>
        <Button butterVariant="primary" size="$5" onPress={() => onComplete?.()}>
          Done
        </Button>
      </Column>
    );
  }

  // Phone collection step
  if (wizardStep === "phone") {
    return (
      <PhoneCollectionStep
        initialPhone={status.phone || undefined}
        onSubmit={handlePhoneSubmit}
        onSkip={handlePhoneSkip}
        isSubmitting={phoneSubmitting}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <Column alignItems="center" justifyContent="center" padding="$xl" minHeight={300}>
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$md">
          Setting up your payout account...
        </Text>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column gap="$lg" padding="$xl">
        <Heading level={3} color="$error">
          Something went wrong
        </Heading>
        <Text color="$textSecondary">{error}</Text>
        <Row gap="$md">
          <Button butterVariant="primary" size="$4" onPress={() => initializeOnboarding()}>
            Try Again
          </Button>
          <Button
            size="$4"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            onPress={() => onExit?.()}
          >
            Cancel
          </Button>
        </Row>
      </Column>
    );
  }

  // Waiting for Stripe instance
  if (!stripeConnectInstance) {
    return (
      <Column alignItems="center" justifyContent="center" padding="$xl" minHeight={300}>
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$md">
          Loading...
        </Text>
      </Column>
    );
  }

  // Stripe onboarding UI
  return (
    <Column gap="$lg" width="100%">
      {/* Header */}
      <Column gap="$sm" alignItems="center">
        <Heading level={2}>Set Up Payouts</Heading>
        <Text color="$textSecondary" textAlign="center" size="$5">
          Complete this quick setup to receive payments when you make sales.
        </Text>
      </Column>

      {/* Benefits */}
      <Card variant="outlined" padding="$md">
        <Row gap="$md" flexWrap="wrap" justifyContent="center">
          <Row gap="$xs" alignItems="center">
            <Lock size={20} color="$textSecondary" />
            <Text size="$4" color="$textSecondary">
              Secure payments
            </Text>
          </Row>
          <Row gap="$xs" alignItems="center">
            <Banknote size={20} color="$textSecondary" />
            <Text size="$4" color="$textSecondary">
              Fast bank transfers
            </Text>
          </Row>
          <Row gap="$xs" alignItems="center">
            <Sparkles size={20} color="$textSecondary" />
            <Text size="$4" color="$textSecondary">
              One-time setup
            </Text>
          </Row>
        </Row>
      </Card>

      {/* Embedded Stripe Onboarding */}
      <Card
        variant="elevated"
        padding="$lg"
        backgroundColor="$surface"
        overflow="hidden"
        width="100%"
      >
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
          <ConnectAccountOnboarding
            onExit={handleOnboardingExit}
            onStepChange={handleStepChange}
            collectionOptions={{
              fields: "eventually_due",
              futureRequirements: "include",
              requirements: {
                exclude: [
                  "business_type",
                  "business_profile.url",
                  "business_profile.product_description",
                  ...(status.phone ? ["individual.phone"] : []),
                ],
              },
            }}
          />
        </ConnectComponentsProvider>
      </Card>

      {/* Cancel link */}
      <Text
        size="$3"
        color="$textTertiary"
        textAlign="center"
        cursor="pointer"
        onPress={() => onExit?.()}
      >
        Cancel and go back
      </Text>
    </Column>
  );
}
