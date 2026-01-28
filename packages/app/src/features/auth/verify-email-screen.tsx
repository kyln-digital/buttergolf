"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Column, Row, ScrollView, Text, Button, Heading, Spinner, useTheme } from "@buttergolf/ui";
import { Button as TamaguiButton } from "tamagui";
import { Mail, ArrowLeft } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignUp } from "@clerk/clerk-expo";
import { TextInput } from "react-native";
import { AuthErrorDisplay } from "./components";
import { mapClerkErrorToMessage } from "./utils";

interface VerifyEmailScreenProps {
  email?: string;
  onSuccess?: () => void;
  onNavigateBack?: () => void;
}

/**
 * Email verification screen
 * User enters 6-digit code sent to their email
 * Includes resend code with countdown timer
 */
export function VerifyEmailScreen({
  email,
  onSuccess,
  onNavigateBack,
}: Readonly<VerifyEmailScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signUp, setActive, isLoaded } = useSignUp();
  const theme = useTheme();
  // Get theme-aware text color for TextInput
  const textColor = theme.text?.val ?? "#323232";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);

  // Refs for each input to handle focus
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Handle countdown timer for resend button
  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = setTimeout(() => {
      setResendCountdown(resendCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Ref to track if we're currently auto-submitting (prevents double-submit)
  const isAutoSubmittingRef = useRef(false);

  // Ref to store handleVerify function for use in handleDigitChange (avoids circular dependency)
  const handleVerifyRef = useRef<(code: string) => Promise<void>>();

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Handle autofill/paste of full code
      const cleanValue = value.replace(/[^0-9]/g, "");

      if (cleanValue.length > 1) {
        // Full code pasted/autofilled - can happen on any input
        const digits = cleanValue.slice(0, 6).split("");
        const newCode = ["*", "*", "*", "*", "*", "*"].map((_, i) => digits[i] || "");
        setCode(newCode);

        // Auto-submit if we have 6 digits
        if (
          digits.length === 6 &&
          isLoaded &&
          signUp &&
          !isSubmitting &&
          !isAutoSubmittingRef.current
        ) {
          isAutoSubmittingRef.current = true;
          // Use setTimeout to ensure state is settled before submitting
          setTimeout(() => {
            handleVerifyRef.current?.(newCode.join(""));
            isAutoSubmittingRef.current = false;
          }, 100);
        }
        return;
      }

      // Single digit entry
      const digit = cleanValue.slice(-1);

      setCode((prev) => {
        const newCode = [...prev];
        newCode[index] = digit;

        // Check if all 6 digits are now filled
        const fullCodeValue = newCode.join("");
        if (
          fullCodeValue.length === 6 &&
          isLoaded &&
          signUp &&
          !isSubmitting &&
          !isAutoSubmittingRef.current
        ) {
          isAutoSubmittingRef.current = true;
          setTimeout(() => {
            handleVerifyRef.current?.(fullCodeValue);
            isAutoSubmittingRef.current = false;
          }, 100);
        }

        return newCode;
      });

      // Auto-advance to next input
      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Clear error when typing
      if (error) {
        setError(null);
      }
    },
    [error, isLoaded, signUp, isSubmitting]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      // Handle backspace - go to previous input
      if (key === "Backspace" && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code]
  );

  const fullCode = code.join("");

  const handleVerify = useCallback(
    async (codeToVerify?: string) => {
      const verificationCode = codeToVerify ?? fullCode;

      setError(null);

      if (verificationCode.length !== 6) {
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
          code: verificationCode,
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
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } finally {
        setIsSubmitting(false);
      }
    },
    [fullCode, isLoaded, signUp, setActive, onSuccess]
  );

  // Keep ref updated with latest handleVerify
  handleVerifyRef.current = handleVerify;

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }, [isLoaded, signUp]);

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
            <TamaguiButton
              chromeless
              size="$4"
              icon={<ArrowLeft size={20} />}
              color="$primary"
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
                ? `We sent a verification code to ${email}`
                : "Enter the 6-digit code we sent to your email"}
            </Text>
          </Column>

          {/* Error Display */}
          {error && <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Code Input Grid */}
          <Column gap="$4" alignItems="center">
            <Row gap="$2" justifyContent="center">
              {code.map((digit, index) => (
                <Column
                  key={index}
                  width={48}
                  height={56}
                  borderRadius="$4"
                  borderWidth={2}
                  borderColor={digit ? "$primary" : "$border"}
                  backgroundColor={digit ? "$primaryLight" : "$surface"}
                  alignItems="center"
                  justifyContent="center"
                  opacity={isSubmitting ? 0.6 : 1}
                >
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) => handleDigitChange(index, text)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={1}
                    editable={!isSubmitting}
                    selectTextOnFocus
                    style={{
                      fontSize: 24,
                      fontWeight: "700",
                      textAlign: "center",
                      width: "100%",
                      height: "100%",
                      color: textColor,
                    }}
                    // Handle paste/autofill - onChange fires with full pasted text
                    onChange={(e) => {
                      const text = e.nativeEvent.text;
                      if (text.length > 1) {
                        // Delegate to handleDigitChange which now handles multi-digit input
                        handleDigitChange(index, text);
                      }
                    }}
                  />
                </Column>
              ))}
            </Row>

            {/* Email Hint */}
            <Row gap="$2" alignItems="center" opacity={0.7}>
              <Mail size={16} color="$textSecondary" />
              <Text size="$3" color="$textSecondary">
                Check your inbox and spam folder
              </Text>
            </Row>
          </Column>

          {/* Verify Button */}
          <Button
            butterVariant="primary"
            size="$5"
            borderRadius="$full"
            fontWeight="600"
            onPress={() => handleVerify()}
            disabled={isSubmitting || fullCode.length !== 6}
            opacity={isSubmitting || fullCode.length !== 6 ? 0.7 : 1}
          >
            {isSubmitting ? <Spinner size="sm" color="$textInverse" /> : "Verify Email"}
          </Button>

          {/* Resend Code */}
          <Column alignItems="center" gap="$3" marginTop="$4">
            <Text size="$4" color="$textSecondary" textAlign="center">
              {"Didn't receive a code?"}
            </Text>

            <TamaguiButton
              chromeless
              size="$4"
              color={resendCountdown > 0 ? "$textMuted" : "$primary"}
              fontWeight="600"
              onPress={handleResendCode}
              disabled={resendCountdown > 0 || isResending}
              opacity={resendCountdown > 0 || isResending ? 0.5 : 1}
              paddingVertical={0}
              paddingHorizontal="$2"
            >
              {isResending ? (
                <Spinner size="sm" color="$primary" />
              ) : resendCountdown > 0 ? (
                `Resend in ${resendCountdown}s`
              ) : (
                "Resend Code"
              )}
            </TamaguiButton>

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
