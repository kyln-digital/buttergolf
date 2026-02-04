import { useState, useCallback } from "react";
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PhoneInput, isValidNumber } from "react-native-phone-entry";
import { Column, Row, Text, Button, Heading, Card } from "@buttergolf/ui";
import { Button as TamaguiButton } from "tamagui";
import { ArrowLeft, Shield, Phone } from "@tamagui/lucide-icons";
import type { ColorTokens } from "tamagui";

// ButterGolf brand colors
const brandColors = {
  spicedClementine: "#F45314",
  vanillaCream: "#FFFAD2",
  ironstone: "#323232",
  slateSmoke: "#545454",
  cloudMist: "#EDEDED",
  pureWhite: "#FFFFFF",
  error: "#dc2626",
};

export interface PhoneCollectionStepProps {
  /** Initial phone value if user has one */
  readonly initialPhone?: string;
  /** Called when user submits a valid phone */
  readonly onSubmit: (phone: string) => Promise<void>;
  /** Called when user skips */
  readonly onSkip: () => void;
  /** Called when user goes back */
  readonly onBack?: () => void;
  /** Whether the form is submitting */
  readonly isSubmitting?: boolean;
}

/**
 * PhoneCollectionStep - Collects UK mobile number using react-native-phone-entry
 *
 * Features:
 * - Country picker with flags
 * - Phone number masking/formatting
 * - libphonenumber validation
 * - Default to GB (UK)
 *
 * This component collects phone before Stripe onboarding, allowing us to
 * pre-fill business_profile.support_phone and skip that field in the Stripe flow.
 */
export function PhoneCollectionStep({
  initialPhone,
  onSubmit,
  onSkip,
  onBack,
  isSubmitting = false,
}: PhoneCollectionStepProps) {
  // Phone state
  const [phoneNumber, setPhoneNumber] = useState(initialPhone ?? "");
  const [countryCode, setCountryCode] = useState<string>("GB");
  const [callingCode, setCallingCode] = useState<string>("+44");
  const [error, setError] = useState<string | null>(null);

  // Handle phone number change
  const handlePhoneChange = useCallback((text: string) => {
    setPhoneNumber(text);
    setError(null);
  }, []);

  // Handle country change
  const handleCountryChange = useCallback((country: { cca2: string; callingCode: string[] }) => {
    setCountryCode(country.cca2);
    setCallingCode(`+${country.callingCode[0]}`);
    setError(null);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    // Validate using libphonenumber
    if (!phoneNumber) {
      setError("Please enter your mobile number");
      return;
    }

    // Get the full number (with calling code)
    const fullNumber = phoneNumber.startsWith("+") ? phoneNumber : `${callingCode}${phoneNumber}`;

    // Validate using google-libphonenumber (via react-native-phone-entry)
    if (!isValidNumber(fullNumber, countryCode)) {
      setError("Please enter a valid phone number");
      return;
    }

    try {
      await onSubmit(fullNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save phone number");
    }
  }, [phoneNumber, callingCode, countryCode, onSubmit]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with back button */}
          {onBack && (
            <Row alignItems="center" marginBottom="$4">
              <TamaguiButton
                chromeless
                circular
                size="$4"
                onPress={onBack}
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={24} color="$text" />
              </TamaguiButton>
            </Row>
          )}

          {/* Header content */}
          <Column gap="$md" alignItems="center" marginBottom="$6">
            <View style={styles.iconContainer}>
              <Phone size={32} color={brandColors.pureWhite as ColorTokens} />
            </View>
            <Heading level={2} textAlign="center">
              Add your mobile number
            </Heading>
            <Text color="$textSecondary" textAlign="center" size="$5">
              We&apos;ll use this to set up secure payments. You can change it later.
            </Text>
          </Column>

          {/* Phone input card */}
          <Card variant="elevated" padding="$lg" marginBottom="$4">
            <Column gap="$lg">
              <Column gap="$xs">
                <Text size="$4" fontWeight="500">
                  Mobile Number
                </Text>
                <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
                  <PhoneInput
                    defaultValues={{
                      countryCode: "GB",
                      callingCode: "+44",
                      phoneNumber: initialPhone ?? "",
                    }}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    onChangeCountry={handleCountryChange}
                    theme={{
                      containerStyle: styles.phoneInputContainer,
                      textContainerStyle: styles.phoneTextContainer,
                      textInputStyle: styles.phoneTextInput,
                      countryPickerButtonStyle: styles.countryPickerButton,
                    }}
                    countryPickerProps={{
                      withFilter: true,
                      withFlag: true,
                      withCallingCode: true,
                      withAlphaFilter: true,
                      filterProps: {
                        placeholder: "Search country...",
                      },
                    }}
                    autoFocus
                    placeholder="7XXX XXX XXX"
                  />
                </View>
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
              <View style={styles.shieldIcon}>
                <Shield size={20} color={brandColors.spicedClementine as ColorTokens} />
              </View>
              <Column gap="$xs" flex={1}>
                <Text size="$4" fontWeight="500">
                  Why do we need this?
                </Text>
                <Text size="$3" color="$textSecondary">
                  Your phone number helps verify your identity and enables secure payouts to your
                  bank account. It may also be used for important order updates.
                </Text>
              </Column>
            </Row>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.vanillaCream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: brandColors.spicedClementine,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: brandColors.cloudMist,
    borderRadius: 12,
    backgroundColor: brandColors.pureWhite,
    overflow: "hidden",
  },
  inputError: {
    borderColor: brandColors.error,
  },
  phoneInputContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 8,
  },
  phoneTextContainer: {
    backgroundColor: "transparent",
    paddingVertical: 0,
  },
  phoneTextInput: {
    fontSize: 16,
    color: brandColors.ironstone,
    paddingVertical: 12,
  },
  countryPickerButton: {
    borderRightWidth: 1,
    borderRightColor: brandColors.cloudMist,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  shieldIcon: {
    marginTop: 2,
  },
});
