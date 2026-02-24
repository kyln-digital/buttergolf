"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Card, Spinner } from "@buttergolf/ui";
import { Lock, Banknote, Sparkles } from "@tamagui/lucide-icons";
import { brandColors } from "@buttergolf/config";
import { ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StepChange, StripeConnectInstance } from "@stripe/connect-js";
import { PhoneCollectionStep } from "./PhoneCollectionStep";

interface SellerStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  accountStatus: string | null;
  requirementsCount: number;
  phone: string | null;
}

type WizardStep = "phone" | "stripe" | "ready";

interface SellOnboardingGateProps {
  /** Initial seller status from server */
  readonly initialStatus: SellerStatus;
  /** The sell form to render when onboarding is complete */
  readonly children: ReactNode;
}

/**
 * SellOnboardingGate - Zero-touch seller onboarding for the /sell page
 *
 * This component wraps the sell form and handles:
 * 1. Collecting UK mobile number (pre-fills Stripe, improves UX)
 * 2. Auto-creating Stripe Connect account on first visit
 * 3. Displaying embedded onboarding inline (no redirect)
 * 4. Showing the sell form once onboarding is complete
 *
 * Wizard flow:
 * - Step 1 (phone): Collect UK mobile (skip if already have it)
 * - Step 2 (stripe): Stripe embedded onboarding (with phone pre-filled if provided)
 * - Step 3 (ready): Show the sell form
 *
 * Uses Stripe Embedded Onboarding with:
 * - UK-only (GB) country prefilled
 * - Individual/private seller type
 * - Phone excluded from Stripe collection if we collected it
 */
export function SellOnboardingGate({ initialStatus, children }: SellOnboardingGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SellerStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(
    null
  );
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const hasReachedSummaryRef = useRef(false);

  // Determine current wizard step
  const isReadyToSell =
    status.hasAccount && status.onboardingComplete && status.accountStatus === "active";

  const needsPhoneCollection = !status.phone && !status.hasAccount;

  const getCurrentStep = (): WizardStep => {
    if (isReadyToSell) return "ready";
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
      // fetchClientSecret is called by Connect.js when it needs a new session
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          // Call our API which creates account if needed and returns client secret
          const response = await fetch("/api/stripe/connect/account", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            // Note: phone is pre-filled on the Stripe account at creation time
            // via the server reading user.phone from database
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
            spacingUnit: "12px", // Stripe requires 8px-20px
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
    // Track when user reaches summary step (considered "complete enough" to sell)
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
        setStatus((prev) => ({
          ...prev,
          hasAccount: data.hasAccount,
          onboardingComplete: data.onboardingComplete ?? false,
          accountStatus: data.chargesEnabled ? "active" : "pending",
          requirementsCount: data.requirements?.currently_due?.length ?? 0,
        }));

        // If complete, refresh page to show sell form
        if (data.onboardingComplete && data.chargesEnabled) {
          router.refresh();
        }
      }
    } catch {
      // Silent fail - user can try again
    }
    hasReachedSummaryRef.current = false;
  }

  // User is ready to sell - show the form
  if (isReadyToSell) {
    return <>{children}</>;
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
      <Column
        backgroundColor="$background"
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
        padding="$xl"
      >
        <Card variant="elevated" padding="$xl" maxWidth={600}>
          <Column gap="$lg" alignItems="center">
            <Spinner size="lg" color="$primary" />
            <Heading level={3}>Setting up your seller account...</Heading>
            <Text color="$textSecondary" textAlign="center">
              This only takes a moment. You&apos;ll be able to list your first item shortly.
            </Text>
          </Column>
        </Card>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column
        backgroundColor="$background"
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
        padding="$xl"
      >
        <Card variant="elevated" padding="$xl" maxWidth={600}>
          <Column gap="$lg">
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
                onPress={() => router.push("/")}
              >
                Go Home
              </Button>
            </Row>
          </Column>
        </Card>
      </Column>
    );
  }

  // Onboarding UI
  if (!stripeConnectInstance) {
    return (
      <Column
        backgroundColor="$background"
        minHeight="100vh"
        alignItems="center"
        justifyContent="center"
        padding="$xl"
      >
        <Card variant="elevated" padding="$xl" maxWidth={600}>
          <Column gap="$md" alignItems="center">
            <Spinner size="lg" color="$primary" />
            <Text color="$textSecondary">Loading onboarding...</Text>
          </Column>
        </Card>
      </Column>
    );
  }

  return (
    <Column backgroundColor="$background" minHeight="100vh" alignItems="center" width="100%">
      <Column maxWidth={960} paddingHorizontal="$6" paddingVertical="$8" width="100%" gap="$lg">
        {/* Header */}
        <Column gap="$xl" alignItems="center">
          <Heading level={2}>Complete quick setup to start selling</Heading>
          <Text color="$textSecondary" textAlign="center" size="$5">
            Before listing your first item, we need a few details for secure payments. This only
            takes 2-3 minutes.
          </Text>
        </Column>

        {/* Benefits card */}
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
                Fast payouts to your bank
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
                // First-pass onboarding: collect only currently due requirements.
                // This minimizes backtracking and keeps later remediation explicit.
                fields: "currently_due",
                futureRequirements: "omit",
                // Keep seller type fixed and hide business profile fields for individual sellers.
                requirements: {
                  exclude: [
                    "business_type",
                    "business_profile.url",
                    "business_profile.product_description",
                  ],
                },
              }}
            />
          </ConnectComponentsProvider>
        </Card>

        {/* Help text */}
        <Text size="$3" color="$textTertiary" textAlign="center">
          Having trouble?{" "}
          <Text size="$3" color="$primary" cursor="pointer">
            Contact support
          </Text>
        </Text>
      </Column>
    </Column>
  );
}
