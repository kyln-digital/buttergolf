"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Column, Row, ScrollView, Text, Button, Heading, Spinner, useTheme } from "@buttergolf/ui";
import { ArrowLeft, ShieldCheck, Smartphone, Mail } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { OtpInput, OtpInputRef } from "react-native-otp-entry";
import { AuthErrorDisplay } from "./components";
import { mapClerkErrorToMessage } from "./utils";

type TwoFactorStrategy = "totp" | "email_code" | "phone_code";

interface TwoFactorScreenProps {
  onSuccess?: () => void;
  onNavigateBack?: () => void;
}

const CODE_LENGTH = 6;

/**
 * Two-factor authentication screen
 * Supports TOTP (authenticator app) and email code strategies
 *
 * Uses react-native-otp-entry for proper iOS/Android autofill support.
 */
export function TwoFactorScreen({ onSuccess, onNavigateBack }: Readonly<TwoFactorScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();
  const theme = useTheme();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<TwoFactorStrategy | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  // Track current OTP value for manual submit button
  const [currentOtp, setCurrentOtp] = useState("");

  // OTP input ref for programmatic control
  const otpRef = useRef<OtpInputRef>(null);
  // Ref to prevent multiple code sends
  const hasInitialized = useRef(false);

  // Detect available 2FA strategy and send email code if needed
  useEffect(() => {
    // Guard against multiple initializations (React Strict Mode, etc.)
    if (hasInitialized.current) return;
    if (!isLoaded || !signIn) return;

    // Capture signIn reference to satisfy TypeScript (we've already checked it's defined)
    const currentSignIn = signIn;

    async function detectAndPrepare() {
      try {
        const factors = currentSignIn.supportedSecondFactors;
        console.log("[TwoFactor] Available factors:", factors);

        if (!factors || factors.length === 0) {
          setError("No two-factor authentication methods available.");
          return;
        }

        // Check for email_code first (most common for Clerk default setup)
        const emailFactor = factors.find((f: { strategy: string }) => f.strategy === "email_code");
        const totpFactor = factors.find((f: { strategy: string }) => f.strategy === "totp");
        const phoneFactor = factors.find((f: { strategy: string }) => f.strategy === "phone_code");

        if (emailFactor) {
          console.log("[TwoFactor] Using email_code strategy");
          setStrategy("email_code");
          // Extract email hint if available
          if ("safeIdentifier" in emailFactor) {
            setEmailHint(emailFactor.safeIdentifier as string);
          }
          // Automatically send the email code (inline to avoid race condition)
          hasInitialized.current = true;
          setIsSendingCode(true);
          try {
            console.log("[TwoFactor] Sending initial email code...");
            await currentSignIn.prepareSecondFactor({
              strategy: "email_code",
            });
            console.log("[TwoFactor] Initial email code sent successfully");
            setCodeSent(true);
          } catch (sendErr) {
            console.error("[TwoFactor] Error sending initial email code:", sendErr);
            const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
            setError(`Failed to send verification code: ${sendErrMsg}`);
          } finally {
            setIsSendingCode(false);
          }
        } else if (totpFactor) {
          console.log("[TwoFactor] Using totp strategy");
          setStrategy("totp");
          hasInitialized.current = true;
          // TOTP doesn't need to send anything - user has authenticator app
        } else if (phoneFactor) {
          console.log("[TwoFactor] Using phone_code strategy");
          setStrategy("phone_code");
          hasInitialized.current = true;
          // Could implement phone code sending here
          setError("Phone verification is not yet supported.");
        } else {
          setError("No supported two-factor method found.");
        }
      } catch (err) {
        console.error("[TwoFactor] Error detecting strategy:", err);
      }
    }

    detectAndPrepare();
  }, [isLoaded, signIn]);

  // Function to send email verification code
  const sendEmailCode = useCallback(async () => {
    if (!isLoaded || !signIn) return;

    setIsSendingCode(true);
    setError(null);

    try {
      console.log("[TwoFactor] Sending email code...");
      await signIn.prepareSecondFactor({
        strategy: "email_code",
      });
      console.log("[TwoFactor] Email code sent successfully");
      setCodeSent(true);
      // Clear any existing code
      otpRef.current?.clear();
    } catch (err) {
      console.error("[TwoFactor] Error sending email code:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to send verification code: ${errorMessage}`);
    } finally {
      setIsSendingCode(false);
    }
  }, [isLoaded, signIn]);

  const handleVerify = useCallback(
    async (code: string) => {
      setError(null);

      if (code.length !== CODE_LENGTH) {
        setError("Please enter all 6 digits");
        return;
      }

      if (!isLoaded || !signIn) {
        setError("Authentication service not ready. Please try again.");
        return;
      }

      if (!strategy) {
        setError("Two-factor strategy not detected. Please go back and try again.");
        return;
      }

      // For email_code strategy, require that the code has actually been sent
      if (strategy === "email_code" && !codeSent) {
        setError("Verification code has not been sent. Please request a new code and try again.");
        return;
      }

      setIsSubmitting(true);

      try {
        console.log("[TwoFactor] Attempting verification with strategy:", strategy);
        const result = await signIn.attemptSecondFactor({
          strategy: strategy,
          code: code,
        });
        console.log("[TwoFactor] Status:", result.status);

        if (result.status === "complete") {
          console.log("[TwoFactor] Session created:", result.createdSessionId);
          await setActive({ session: result.createdSessionId });
          onSuccess?.();
        } else {
          console.log("[TwoFactor] Unhandled status:", result.status);
          setError("Verification incomplete. Please try again.");
        }
      } catch (err) {
        console.error("[TwoFactor] Error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (
          errorMessage.includes("verification_code_invalid") ||
          errorMessage.includes("incorrect_code")
        ) {
          setError(mapClerkErrorToMessage("verification_code_invalid"));
        } else if (errorMessage.includes("verification_code_expired")) {
          setError(mapClerkErrorToMessage("verification_code_expired"));
        } else {
          setError(errorMessage || "Verification failed. Please try again.");
        }

        // Clear code on error
        otpRef.current?.clear();
      } finally {
        setIsSubmitting(false);
      }
    },
    [isLoaded, signIn, setActive, onSuccess, strategy, codeSent]
  );

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

          {/* Security Icon */}
          <Column alignItems="center" paddingVertical="$4">
            <Column backgroundColor="$primaryLight" padding="$5" borderRadius="$full">
              {strategy === "email_code" ? (
                <Mail size={48} color="$primary" />
              ) : (
                <ShieldCheck size={48} color="$primary" />
              )}
            </Column>
          </Column>

          {/* Header */}
          <Column gap="$2" alignItems="center">
            <Heading level={1} size="$8" fontWeight="700" color="$text" textAlign="center">
              {strategy === "email_code" ? "Check Your Email" : "Two-Factor Authentication"}
            </Heading>
            <Text size="$5" color="$textSecondary" textAlign="center">
              {strategy === "email_code"
                ? `Enter the 6-digit code we sent to ${emailHint || "your email"}`
                : "Enter the 6-digit code from your authenticator app"}
            </Text>
            {isSendingCode && (
              <Row gap="$2" alignItems="center" marginTop="$2">
                <Spinner size="sm" color="$primary" />
                <Text size="$4" color="$textMuted">
                  Sending code...
                </Text>
              </Row>
            )}
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
              disabled={isSubmitting || isSendingCode}
              type="numeric"
              textInputProps={{
                accessibilityLabel: "Enter 6-digit verification code",
                // Enable OTP autofill for email codes but not TOTP
                textContentType: strategy !== "totp" ? "oneTimeCode" : undefined,
                autoComplete: strategy !== "totp" ? "one-time-code" : undefined,
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

            {/* Strategy-specific hint */}
            {strategy === "email_code" ? (
              <Row gap="$2" alignItems="center" opacity={0.7}>
                <Mail size={16} color="$textSecondary" />
                <Text size="$3" color="$textSecondary">
                  Check your email inbox and spam folder
                </Text>
              </Row>
            ) : (
              <Row gap="$2" alignItems="center" opacity={0.7}>
                <Smartphone size={16} color="$textSecondary" />
                <Text size="$3" color="$textSecondary">
                  Open your authenticator app to view your code
                </Text>
              </Row>
            )}
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
            disabled={isSubmitting || isSendingCode || currentOtp.length !== CODE_LENGTH}
            opacity={isSubmitting || isSendingCode || currentOtp.length !== CODE_LENGTH ? 0.7 : 1}
          >
            {isSubmitting ? <Spinner size="sm" color="$textInverse" /> : "Verify Code"}
          </Button>

          {/* Help Text / Resend Code */}
          <Column alignItems="center" gap="$3" marginTop="$4">
            {strategy === "email_code" ? (
              <>
                <Text size="$4" color="$textSecondary" textAlign="center">
                  {"Didn't receive the code?"}
                </Text>
                <Button
                  chromeless
                  size="$4"
                  onPress={sendEmailCode}
                  disabled={isSendingCode}
                  opacity={isSendingCode ? 0.5 : 1}
                >
                  <Button.Text color="$primary">
                    {isSendingCode ? "Sending..." : "Resend Code"}
                  </Button.Text>
                </Button>
              </>
            ) : (
              <>
                <Text size="$4" color="$textSecondary" textAlign="center">
                  {"Can't access your authenticator?"}
                </Text>
                <Text size="$3" color="$textMuted" textAlign="center" paddingHorizontal="$4">
                  Contact support if you've lost access to your two-factor authentication device
                </Text>
              </>
            )}
          </Column>
        </Column>
      </ScrollView>
    </Column>
  );
}
