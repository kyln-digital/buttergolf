"use client";

import { useState } from "react";
import { Column, Row, Heading, Text, Button, Card, Input } from "@buttergolf/ui";

// UK mobile phone number regex (07xxx or +447xxx, no spaces - we strip spaces before validation)
const UK_MOBILE_REGEX = /^(?:\+44|0)7\d{9}$/;

/**
 * Format a phone number for display (07XXX XXX XXX)
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters except +
  const cleaned = value.replace(/[^\d+]/g, "");

  // If starts with +44, convert to 0
  let digits = cleaned;
  if (cleaned.startsWith("+44")) {
    digits = "0" + cleaned.slice(3);
  }

  // Only keep 11 digits max (UK mobile)
  digits = digits.slice(0, 11);

  // Format as 07XXX XXX XXX
  if (digits.length >= 5) {
    return (
      digits.slice(0, 5) +
      " " +
      digits.slice(5, 8) +
      (digits.length > 8 ? " " + digits.slice(8) : "")
    );
  }
  return digits;
}

/**
 * Normalize phone to +44 format for Stripe
 */
function normalizeToE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) {
    return "+44" + digits.slice(1);
  }
  if (digits.startsWith("44")) {
    return "+" + digits;
  }
  return "+44" + digits;
}

interface PhoneCollectionStepProps {
  /** Initial phone value if user has one */
  readonly initialPhone?: string;
  /** Called when user submits a valid phone */
  readonly onSubmit: (phone: string) => Promise<void>;
  /** Called when user skips (phone will be collected during Stripe onboarding) */
  readonly onSkip: () => void;
  /** Whether the form is submitting */
  readonly isSubmitting?: boolean;
}

/**
 * PhoneCollectionStep - Collects UK mobile number before Stripe onboarding
 *
 * This allows us to pre-fill the phone number in Stripe Connect and exclude
 * that field from their embedded onboarding form, creating a smoother experience.
 *
 * Users can skip this step - Stripe will collect the phone during their flow instead.
 */
export function PhoneCollectionStep({
  initialPhone,
  onSubmit,
  onSkip,
  isSubmitting = false,
}: PhoneCollectionStepProps) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [error, setError] = useState<string | null>(null);

  function handlePhoneChange(value: string) {
    setError(null);
    setPhone(formatPhoneNumber(value));
  }

  async function handleSubmit() {
    // Validate
    const cleaned = phone.replace(/\s/g, "");
    if (!cleaned) {
      setError("Please enter your mobile number");
      return;
    }

    if (!UK_MOBILE_REGEX.test(cleaned)) {
      setError("Please enter a valid UK mobile number (e.g., 07XXX XXX XXX)");
      return;
    }

    // Normalize to E.164 format for Stripe
    const normalized = normalizeToE164(cleaned);
    await onSubmit(normalized);
  }

  return (
    <Column backgroundColor="$background" minHeight="100vh" alignItems="center" width="100%">
      <Column maxWidth={600} paddingHorizontal="$6" paddingVertical="$8" width="100%" gap="$lg">
        {/* Header */}
        <Column gap="$md" alignItems="center">
          <Text size="$10">📱</Text>
          <Heading level={2} textAlign="center">
            Add your mobile number
          </Heading>
          <Text color="$textSecondary" textAlign="center" size="$5">
            We&apos;ll use this to set up secure payments. You can change it later.
          </Text>
        </Column>

        {/* Form card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$lg">
            <Column gap="$xs">
              <Text size="$4" fontWeight="500">
                UK Mobile Number
              </Text>
              <Input
                size="$5"
                placeholder="07XXX XXX XXX"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                autoComplete="tel"
                autoFocus
                borderColor={error ? "$error" : undefined}
              />
              {error && (
                <Text size="$3" color="$error">
                  {error}
                </Text>
              )}
              <Text size="$3" color="$textTertiary">
                Used for payment verification and delivery updates
              </Text>
            </Column>

            <Column gap="$md">
              <Button
                butterVariant="primary"
                size="$5"
                width="100%"
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </Button>

              <Button
                butterVariant="secondary"
                size="$4"
                width="100%"
                onPress={onSkip}
                disabled={isSubmitting}
              >
                Skip for now
              </Button>
            </Column>
          </Column>
        </Card>

        {/* Why we need this */}
        <Card variant="outlined" padding="$md">
          <Row gap="$sm" alignItems="flex-start">
            <Text size="$5">🔒</Text>
            <Column gap="$xs" flex={1}>
              <Text size="$4" fontWeight="500">
                Why do we need this?
              </Text>
              <Text size="$3" color="$textSecondary">
                Your phone number helps verify your identity and enables secure payouts to your bank
                account. It may also be used for important order updates.
              </Text>
            </Column>
          </Row>
        </Card>
      </Column>
    </Column>
  );
}
