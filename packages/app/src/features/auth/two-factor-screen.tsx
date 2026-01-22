"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Column,
  Row,
  ScrollView,
  Text,
  Button,
  Heading,
  Spinner,
} from "@buttergolf/ui";
import { Button as TamaguiButton } from "tamagui";
import { ArrowLeft, ShieldCheck, Smartphone, Mail } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { TextInput } from "react-native";
import { AuthErrorDisplay } from "./components";
import { mapClerkErrorToMessage } from "./utils";

type TwoFactorStrategy = "totp" | "email_code" | "phone_code";

interface TwoFactorScreenProps {
  onSuccess?: () => void;
  onNavigateBack?: () => void;
}

/**
 * Two-factor authentication screen
 * Supports TOTP (authenticator app) and email code strategies
 */
export function TwoFactorScreen({
  onSuccess,
  onNavigateBack,
}: Readonly<TwoFactorScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<TwoFactorStrategy | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // Refs for each input to handle focus
  const inputRefs = useRef<(TextInput | null)[]>([]);
  // Ref to prevent multiple code sends
  const hasInitialized = useRef(false);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Only allow single digit
      const digit = value.replace(/[^0-9]/g, "").slice(-1);

      setCode((prev) => {
        const newCode = [...prev];
        newCode[index] = digit;
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
    [error],
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      // Handle backspace - go to previous input
      if (key === "Backspace" && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code],
  );

  const handlePaste = useCallback((pastedText: string) => {
    const digits = pastedText
      .replace(/[^0-9]/g, "")
      .slice(0, 6)
      .split("");
    if (digits.length > 0) {
      const newCode = ["", "", "", "", "", ""];
      digits.forEach((digit, i) => {
        newCode[i] = digit;
      });
      setCode(newCode);
      // Focus the next empty input or last input
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  }, []);

  const fullCode = code.join("");

  // Ref to store the latest handleVerify function for auto-submit
  const handleVerifyRef = useRef<(() => Promise<void>) | null>(null);

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
        const emailFactor = factors.find(
          (f: { strategy: string }) => f.strategy === "email_code",
        );
        const totpFactor = factors.find(
          (f: { strategy: string }) => f.strategy === "totp",
        );
        const phoneFactor = factors.find(
          (f: { strategy: string }) => f.strategy === "phone_code",
        );

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
    } catch (err) {
      console.error("[TwoFactor] Error sending email code:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to send verification code: ${errorMessage}`);
    } finally {
      setIsSendingCode(false);
    }
  }, [isLoaded, signIn]);

  const handleVerify = useCallback(async () => {
    setError(null);

    if (fullCode.length !== 6) {
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

    setIsSubmitting(true);

    try {
      console.log("[TwoFactor] Attempting verification with strategy:", strategy);
      const result = await signIn.attemptSecondFactor({
        strategy: strategy,
        code: fullCode,
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
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }, [fullCode, isLoaded, signIn, setActive, onSuccess, strategy]);

  // Keep ref updated with latest handleVerify function
  handleVerifyRef.current = handleVerify;

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    // For email_code strategy, wait until code has been sent
    const canAutoSubmit =
      fullCode.length === 6 &&
      !isSubmitting &&
      isLoaded &&
      signIn &&
      strategy &&
      (strategy !== "email_code" || codeSent);

    if (canAutoSubmit) {
      handleVerifyRef.current?.();
    }
  }, [fullCode, isSubmitting, isLoaded, signIn, strategy, codeSent]);

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

          {/* Security Icon */}
          <Column alignItems="center" paddingVertical="$4">
            <Column
              backgroundColor="$primaryLight"
              padding="$5"
              borderRadius="$full"
            >
              {strategy === "email_code" ? (
                <Mail size={48} color="$primary" />
              ) : (
                <ShieldCheck size={48} color="$primary" />
              )}
            </Column>
          </Column>

          {/* Header */}
          <Column gap="$2" alignItems="center">
            <Heading
              level={1}
              size="$8"
              fontWeight="700"
              color="$text"
              textAlign="center"
            >
              {strategy === "email_code" ? "Check Your Email" : "Two-Factor Authentication"}
            </Heading>
            <Text size="$5" color="$textSecondary" textAlign="center">
              {strategy === "email_code" 
                ? `Enter the 6-digit code we sent to ${emailHint || "your email"}`
                : "Enter the 6-digit code from your authenticator app"
              }
            </Text>
            {isSendingCode && (
              <Row gap="$2" alignItems="center" marginTop="$2">
                <Spinner size="sm" color="$primary" />
                <Text size="$4" color="$textMuted">Sending code...</Text>
              </Row>
            )}
          </Column>

          {/* Error Display */}
          {error && (
            <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />
          )}

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
                    onKeyPress={({ nativeEvent }) =>
                      handleKeyPress(index, nativeEvent.key)
                    }
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
                      color: "#323232",
                    }}
                    // Handle paste on first input
                    onChange={(e) => {
                      const text = e.nativeEvent.text;
                      if (text.length > 1 && index === 0) {
                        handlePaste(text);
                      }
                    }}
                  />
                </Column>
              ))}
            </Row>

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

          {/* Verify Button */}
          <Button
            butterVariant="primary"
            size="$5"
            borderRadius="$full"
            fontWeight="600"
            onPress={handleVerify}
            disabled={isSubmitting || fullCode.length !== 6 || isSendingCode}
            opacity={isSubmitting || fullCode.length !== 6 || isSendingCode ? 0.7 : 1}
          >
            {isSubmitting ? (
              <Spinner size="sm" color="$textInverse" />
            ) : (
              "Verify Code"
            )}
          </Button>

          {/* Help Text / Resend Code */}
          <Column alignItems="center" gap="$3" marginTop="$4">
            {strategy === "email_code" ? (
              <>
                <Text size="$4" color="$textSecondary" textAlign="center">
                  {"Didn't receive the code?"}
                </Text>
                <TamaguiButton
                  chromeless
                  size="$4"
                  color="$primary"
                  onPress={sendEmailCode}
                  disabled={isSendingCode}
                  opacity={isSendingCode ? 0.5 : 1}
                >
                  {isSendingCode ? "Sending..." : "Resend Code"}
                </TamaguiButton>
              </>
            ) : (
              <>
                <Text size="$4" color="$textSecondary" textAlign="center">
                  {"Can't access your authenticator?"}
                </Text>
                <Text
                  size="$3"
                  color="$textMuted"
                  textAlign="center"
                  paddingHorizontal="$4"
                >
                  Contact support if you've lost access to your two-factor
                  authentication device
                </Text>
              </>
            )}
          </Column>
        </Column>
      </ScrollView>
    </Column>
  );
}
