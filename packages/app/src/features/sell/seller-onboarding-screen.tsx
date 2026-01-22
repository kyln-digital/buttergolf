import { View, Text, Button, YStack, XStack, Spinner } from "@buttergolf/ui";
import { useState, useCallback } from "react";
import type { SellerStatus } from "../../hooks/useSellerStatus";

export interface SellerOnboardingScreenProps {
  /** Current seller status */
  sellerStatus: SellerStatus | null;
  /** Whether status is being loaded */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to start the Stripe onboarding process */
  onStartOnboarding: () => Promise<void>;
  /** Called when onboarding is skipped/cancelled */
  onCancel?: () => void;
  /** Called when user wants to continue incomplete onboarding */
  onContinueOnboarding?: () => Promise<void>;
  /** Refresh seller status */
  onRefresh: () => Promise<void>;
}

/**
 * SellerOnboardingScreen - Prompts user to complete Stripe seller onboarding.
 *
 * This screen is shown when a user taps "Sell" but hasn't completed
 * Stripe Connect onboarding. It explains the process and provides
 * a button to start onboarding via Stripe's hosted flow.
 *
 * States:
 * - Initial: Show "Become a Seller" prompt
 * - Loading: Show spinner while onboarding link is being created
 * - Incomplete: Show "Continue Onboarding" if user started but didn't finish
 * - Error: Show error message with retry button
 */
export function SellerOnboardingScreen({
  sellerStatus,
  isLoading,
  error,
  onStartOnboarding,
  onCancel,
  onContinueOnboarding,
  onRefresh,
}: SellerOnboardingScreenProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStartOnboarding = useCallback(async () => {
    try {
      setIsStarting(true);
      setLocalError(null);
      await onStartOnboarding();
    } catch (err) {
      console.error("[SellerOnboarding] Error starting onboarding:", err);
      setLocalError(
        err instanceof Error ? err.message : "Failed to start onboarding"
      );
    } finally {
      setIsStarting(false);
    }
  }, [onStartOnboarding]);

  const handleContinueOnboarding = useCallback(async () => {
    if (!onContinueOnboarding) return;
    try {
      setIsStarting(true);
      setLocalError(null);
      await onContinueOnboarding();
    } catch (err) {
      console.error("[SellerOnboarding] Error continuing onboarding:", err);
      setLocalError(
        err instanceof Error ? err.message : "Failed to continue onboarding"
      );
    } finally {
      setIsStarting(false);
    }
  }, [onContinueOnboarding]);

  // Loading state
  if (isLoading) {
    return (
      <View
        flex={1}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        padding="$lg"
      >
        <Spinner size="lg" color="$primary" />
        <Text size="$5" color="$textSecondary" marginTop="$md">
          Checking seller status...
        </Text>
      </View>
    );
  }

  // Determine the state to show
  const hasAccount = sellerStatus?.hasAccount ?? false;
  const onboardingComplete = sellerStatus?.onboardingComplete ?? false;
  const accountStatus = sellerStatus?.accountStatus;

  // User has started but not completed onboarding
  const showContinue = hasAccount && !onboardingComplete;

  // Account is restricted (onboarding done but issues with account)
  const showRestricted = hasAccount && onboardingComplete && accountStatus === "restricted";

  const displayError = localError || error;

  return (
    <View flex={1} backgroundColor="$background">
      <YStack
        flex={1}
        padding="$xl"
        alignItems="center"
        justifyContent="center"
        gap="$lg"
      >
        {/* Icon/Illustration placeholder */}
        <View
          width={120}
          height={120}
          borderRadius="$full"
          backgroundColor="$primaryLight"
          alignItems="center"
          justifyContent="center"
          marginBottom="$md"
        >
          <Text size="$13">💰</Text>
        </View>

        {/* Title */}
        <Text
          size="$9"
          fontWeight="700"
          color="$text"
          textAlign="center"
        >
          {showContinue
            ? "Complete Your Seller Setup"
            : showRestricted
              ? "Account Needs Attention"
              : "Become a Seller"}
        </Text>

        {/* Description */}
        <Text
          size="$5"
          color="$textSecondary"
          textAlign="center"
          maxWidth={320}
          lineHeight={22}
        >
          {showContinue
            ? "You're almost there! Complete a few more steps to start selling your golf equipment on ButterGolf."
            : showRestricted
              ? "Your seller account needs additional information. Please complete the verification to continue selling."
              : "Start selling your golf equipment to thousands of enthusiasts. Set up takes just a few minutes."}
        </Text>

        {/* Benefits list */}
        {!showContinue && !showRestricted && (
          <YStack gap="$sm" marginTop="$md" width="100%" maxWidth={320}>
            <XStack gap="$sm" alignItems="center">
              <Text color="$success">✓</Text>
              <Text size="$4" color="$text">
                Secure payments via Stripe
              </Text>
            </XStack>
            <XStack gap="$sm" alignItems="center">
              <Text color="$success">✓</Text>
              <Text size="$4" color="$text">
                Daily payouts to your bank
              </Text>
            </XStack>
            <XStack gap="$sm" alignItems="center">
              <Text color="$success">✓</Text>
              <Text size="$4" color="$text">
                Reach thousands of golfers
              </Text>
            </XStack>
          </YStack>
        )}

        {/* Error message */}
        {displayError && (
          <View
            backgroundColor="$errorLight"
            padding="$md"
            borderRadius="$md"
            width="100%"
            maxWidth={320}
          >
            <Text size="$4" color="$error" textAlign="center">
              {displayError}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <YStack gap="$md" width="100%" maxWidth={320} marginTop="$lg">
          {isStarting ? (
            <View
              height={56}
              alignItems="center"
              justifyContent="center"
            >
              <Spinner size="sm" color="$primary" />
              <Text size="$4" color="$textSecondary" marginTop="$sm">
                Opening Stripe...
              </Text>
            </View>
          ) : (
            <>
              <Button
                butterVariant="primary"
                size="$5"
                onPress={
                  showContinue || showRestricted
                    ? handleContinueOnboarding
                    : handleStartOnboarding
                }
                disabled={isStarting}
              >
                <Text color="$textInverse" fontWeight="600">
                  {showContinue || showRestricted
                    ? "Continue Setup"
                    : "Get Started"}
                </Text>
              </Button>

              {onCancel && (
                <Button
                  butterVariant="tertiary"
                  size="$5"
                  onPress={onCancel}
                  disabled={isStarting}
                >
                  <Text color="$textSecondary" fontWeight="600">Not Now</Text>
                </Button>
              )}

              {displayError && (
                <Button
                  butterVariant="tertiary"
                  size="$4"
                  onPress={onRefresh}
                  disabled={isStarting}
                >
                  <Text color="$primary" fontWeight="500">Refresh Status</Text>
                </Button>
              )}
            </>
          )}
        </YStack>

        {/* Footer note */}
        <Text
          size="$3"
          color="$textSecondary"
          textAlign="center"
          maxWidth={280}
          marginTop="$lg"
        >
          You'll be redirected to Stripe to verify your identity and set up
          payouts. This usually takes 2-3 minutes.
        </Text>
      </YStack>
    </View>
  );
}
