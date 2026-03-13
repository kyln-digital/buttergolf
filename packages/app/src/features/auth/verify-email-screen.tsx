"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Column, Row, ScrollView, Text, Button, Heading, Spinner, useTheme } from "@buttergolf/ui";
import { Mail, ArrowLeft } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignUp } from "@clerk/clerk-expo";
import { OtpInput, OtpInputRef } from "react-native-otp-entry";
import { AuthErrorDisplay } from "./components";
import { mapClerkErrorToMessage } from "./utils";

interface VerifyEmailScreenProps {
  email?: string;
  onSuccess?: () => void;
  onNavigateBack?: () => void;
}

const CODE_LENGTH = 6;

/**
 * Email verification screen
 * User enters 6-digit code sent to their email
 * Includes resend code with countdown timer
 *
 * Uses react-native-otp-entry for proper iOS/Android autofill support.
 */
export function VerifyEmailScreen({
  email,
  onSuccess,
  onNavigateBack,
}: Readonly<VerifyEmailScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signUp, setActive, isLoaded } = useSignUp();
  const theme = useTheme();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  // Track current OTP value for manual submit button
  const [currentOtp, setCurrentOtp] = useState("");

  // OTP input ref for programmatic control
  const otpRef = useRef<OtpInputRef>(null);

  // Handle countdown timer for resend button
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setTimeout(() => {
      setResendCountdown(resendCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleVerify = useCallback(
    async (code: string) => {
      setError(null);

      if (code.length !== CODE_LENGTH) {
        setError("Please enter all 6 digits");
        return;
      }

      if (!isLoaded || !signUp) {
        setError("Authentication service not ready. Please try again.");
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await signUp.attemptEmailAddressVerification({
          code,
        });

        if (result.status === "complete") {
          // User successfully verified
          await setActive({ session: result.createdSessionId });
          onSuccess?.();
        } else {
          setError("Verification incomplete. Please try again.");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (errorMessage.includes("verification_code_invalid")) {
          setError(mapClerkErrorToMessage("verification_code_invalid"));
        } else if (errorMessage.includes("verification_code_expired")) {
          setError(mapClerkErrorToMessage("verification_code_expired"));
        } else {
          setError(errorMessage || "Verification failed. Please check your code and try again.");
        }

        // Clear code on error
        otpRef.current?.clear();
      } finally {
        setIsSubmitting(false);
      }
    },
    [isLoaded, signUp, setActive, onSuccess]
  );

  const handleResendCode = useCallback(async () => {
    setError(null);

    if (!isLoaded || !signUp) {
      setError("Authentication service not ready. Please try again.");
      return;
    }

    setIsResending(true);

    try {
      await signUp.prepareEmailAddressVerification();
      setResendCountdown(60);
      setResendAttempts((prev) => prev + 1);
      // Clear any existing code
      otpRef.current?.clear();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }, [isLoaded, signUp]);

  // Get theme colors for OTP input styling
  const primaryColor = theme.primary?.val ?? "#F45314";
  const borderColor = theme.border?.val ?? "#EDEDED";
  const surfaceColor = theme.surface?.val ?? "#FFFFFF";
  const primaryLightColor = theme.primaryLight?.val ?? "#FFFAD2";
  const textColor = theme.text?.val ?? "#323232";

  return (
    <Column flex={1} backgroundColor="$background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: 16,
          minHeight: "100%",
        }}
      >
        <Column gap="$6" flex={1}>
          {/* Back Button */}
          {onNavigateBack && (
            <Button
              chromeless
              size="$4"
              icon={<ArrowLeft size={20} color="$primary" />}
              alignSelf="flex-start"
              onPress={onNavigateBack}
              paddingHorizontal={0}
            />
          )}

          {/* Email Icon */}
          <Column alignItems="center" paddingVertical="$4">
            <Column backgroundColor="$primaryLight" padding="$5" borderRadius="$full">
              <Mail size={48} color="$primary" />
            </Column>
          </Column>

          {/* Header */}
          <Column gap="$2" alignItems="center">
            <Heading level={1} size="$8" fontWeight="700" color="$text" textAlign="center">
              Check Your Email
            </Heading>
            <Text size="$5" color="$textSecondary" textAlign="center">
              {email
                ? `Enter the 6-digit code we sent to ${email}`
                : "Enter the 6-digit code we sent to your email"}
            </Text>
          </Column>

          {/* Error Display */}
          {error && <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* OTP Input */}
          <Column gap="$4" alignItems="center">
            <OtpInput
              ref={otpRef}
              numberOfDigits={CODE_LENGTH}
              onFilled={handleVerify}
              onTextChange={setCurrentOtp}
              focusColor={primaryColor}
              disabled={isSubmitting}
              type="numeric"
              textInputProps={{
                accessibilityLabel: "Enter 6-digit verification code",
              }}
              theme={{
                containerStyle: {
                  width: "100%",
                  justifyContent: "center",
                  gap: 8,
                },
                pinCodeContainerStyle: {
                  width: 48,
                  height: 56,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: borderColor,
                  backgroundColor: surfaceColor,
                },
                pinCodeTextStyle: {
                  fontSize: 24,
                  fontWeight: "700",
                  color: textColor,
                },
                focusedPinCodeContainerStyle: {
                  borderColor: primaryColor,
                  backgroundColor: primaryLightColor,
                },
                filledPinCodeContainerStyle: {
                  borderColor: primaryColor,
                  backgroundColor: primaryLightColor,
                },
                disabledPinCodeContainerStyle: {
                  opacity: 0.6,
                },
              }}
            />

            {/* Email Hint */}
            <Row gap="$2" alignItems="center" opacity={0.7}>
              <Mail size={16} color="$textSecondary" />
              <Text size="$3" color="$textSecondary">
                Check your inbox and spam folder
              </Text>
            </Row>
          </Column>

          {/* Verify Button - provides manual submit fallback for accessibility */}
          <Button
            butterVariant="primary"
            size="$5"
            borderRadius="$full"
            onPress={() => {
              if (currentOtp.length === CODE_LENGTH) {
                handleVerify(currentOtp);
              } else {
                setError("Please enter all 6 digits");
              }
            }}
            disabled={isSubmitting || currentOtp.length !== CODE_LENGTH}
            opacity={isSubmitting || currentOtp.length !== CODE_LENGTH ? 0.7 : 1}
          >
            {isSubmitting ? <Spinner size="sm" color="$textInverse" /> : "Verify Email"}
          </Button>

          {/* Resend Code */}
          <Column alignItems="center" gap="$3" marginTop="$4">
            <Text size="$4" color="$textSecondary" textAlign="center">
              {"Didn't receive a code?"}
            </Text>

            <Button
              chromeless
              size="$4"
              onPress={handleResendCode}
              disabled={resendCountdown > 0 || isResending}
              opacity={resendCountdown > 0 || isResending ? 0.5 : 1}
              paddingVertical={0}
              paddingHorizontal="$2"
            >
              {isResending ? (
                <Spinner size="sm" color="$primary" />
              ) : resendCountdown > 0 ? (
                <TamaguiButton.Text color="$textMuted">{`Resend in ${resendCountdown}s`}</TamaguiButton.Text>
              ) : (
                <TamaguiButton.Text color="$primary">Resend Code</TamaguiButton.Text>
              )}
            </Button>

            {resendAttempts > 0 && (
              <Text size="$3" color="$textMuted" textAlign="center">
                Code resent {resendAttempts} time{resendAttempts > 1 ? "s" : ""}
              </Text>
            )}
          </Column>

          {/* Help Text */}
          <Column alignItems="center" gap="$3" marginTop="$4">
            <Text size="$3" color="$textMuted" textAlign="center" paddingHorizontal="$4">
              {"Having trouble? Make sure to check your spam folder or try resending the code"}
            </Text>
          </Column>
        </Column>
      </ScrollView>
    </Column>
  );
}
