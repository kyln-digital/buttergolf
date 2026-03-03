"use client";

import { useState } from "react";
import { Column, Row, Heading, Text, Button, Card } from "@buttergolf/ui";
import { Lock, Smartphone } from "@tamagui/lucide-icons";
import PhoneInput, { isValidPhoneNumber, type Value } from "react-phone-number-input";
import "react-phone-number-input/style.css";

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
 * PhoneCollectionStep - Collects mobile number before Stripe onboarding
 *
 * Uses react-phone-number-input with libphonenumber-js for:
 * - Country picker with flags
 * - Auto-formatting
 * - International phone number validation
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
  const [phone, setPhone] = useState<Value | undefined>(initialPhone as Value | undefined);
  const [error, setError] = useState<string | null>(null);

  function handlePhoneChange(value: Value | undefined) {
    setError(null);
    setPhone(value);
  }

  async function handleSubmit() {
    if (!phone) {
      setError("Please enter your mobile number");
      return;
    }

    // Validate using libphonenumber-js
    if (!isValidPhoneNumber(phone)) {
      setError("Please enter a valid phone number");
      return;
    }

    // Phone is already in E.164 format from react-phone-number-input
    await onSubmit(phone);
  }

  return (
    <Column backgroundColor="$background" minHeight="100vh" alignItems="center" width="100%">
      <Column maxWidth={600} paddingHorizontal="$6" paddingVertical="$8" width="100%" gap="$lg">
        {/* Header */}
        <Column gap="$md" alignItems="center">
          <Smartphone size={36} color="$textSecondary" />
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
                Mobile Number
              </Text>
              <div
                className="phone-input-wrapper"
                style={{
                  border: error ? "1px solid #dc2626" : "1px solid #EDEDED",
                  borderRadius: 12,
                  backgroundColor: "#FFFFFF",
                  padding: "4px 12px",
                }}
              >
                <PhoneInput
                  international
                  defaultCountry="GB"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="Enter phone number"
                />
              </div>
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
            <Lock size={18} color="$textSecondary" style={{ marginTop: 2 }} />
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

      {/* Custom styles for phone input to match design system */}
      {/* eslint-disable-next-line react/no-unknown-property -- Next.js styled-jsx syntax */}
      <style jsx global>{`
        .phone-input-wrapper .PhoneInput {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .phone-input-wrapper .PhoneInputCountry {
          padding: 8px 0;
        }
        .phone-input-wrapper .PhoneInputCountryIcon {
          width: 24px;
          height: 18px;
        }
        .phone-input-wrapper .PhoneInputCountrySelectArrow {
          margin-left: 4px;
          opacity: 0.6;
        }
        .phone-input-wrapper .PhoneInputInput {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 16px;
          color: #323232;
          padding: 12px 0;
          outline: none;
        }
        .phone-input-wrapper .PhoneInputInput::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </Column>
  );
}
