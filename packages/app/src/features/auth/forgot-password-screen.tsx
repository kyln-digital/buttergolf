"use client";

import React, { useState, useCallback } from "react";
import { Column, ScrollView, Text, Button, Heading, Spinner } from "@buttergolf/ui";
import { Button as TamaguiButton } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { AuthFormInput, AuthErrorDisplay } from "./components";
import { validateEmail, mapClerkErrorToMessage } from "./utils";

interface ForgotPasswordScreenProps {
  onSuccess?: (email: string) => void;
  onNavigateBack?: () => void;
}

/**
 * Forgot password screen
 * User enters email to receive password reset code
 */
export function ForgotPasswordScreen({
  onSuccess,
  onNavigateBack,
}: Readonly<ForgotPasswordScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signIn, isLoaded } = useSignIn();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = useCallback(
    (newEmail: string) => {
      setEmail(newEmail);
      if (emailError) {
        setEmailError(null);
      }
    },
    [emailError]
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate email
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    if (!isLoaded || !signIn) {
      setError("Authentication service not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Initiate sign-in with email for password reset
      // This automatically prepares the password reset code verification
      await signIn.create({
        identifier: email,
        // The password reset will be handled via firstFactorVerification
      });

      // Call success to navigate to reset password screen
      onSuccess?.(email);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes("identifier_not_found")) {
        setError(mapClerkErrorToMessage("identifier_not_found"));
      } else {
        setError(
          errorMessage || "Failed to process request. Please check your email and try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isLoaded, signIn, onSuccess]);

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
          {/* Header */}
          <Column gap="$2">
            <Heading level={1} size="$8" fontWeight="700" color="$text">
              Reset Password
            </Heading>
            <Text size="$5" color="$textSecondary">
              Enter your email to receive a reset code
            </Text>
          </Column>

          {/* Error Display */}
          {error && <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Email Input */}
          <Column gap="$4">
            <AuthFormInput
              label="Email"
              value={email}
              onChangeText={handleEmailChange}
              placeholder="your@email.com"
              type="email"
              error={emailError}
              editable={!isSubmitting}
              autoComplete="email"
            />

            <Text size="$3" color="$textMuted">
              We'll send a code to your email to reset your password
            </Text>
          </Column>

          {/* Submit Button */}
          <Button
            butterVariant="primary"
            size="$5"
            borderRadius="$full"
            onPress={handleSubmit}
            disabled={isSubmitting || !isLoaded}
            opacity={isSubmitting ? 0.7 : 1}
          >
            {isSubmitting ? <Spinner size="sm" color="$textInverse" /> : "Send Reset Code"}
          </Button>

          {/* Back Button */}
          <TamaguiButton
            chromeless
            size="$4"
            onPress={onNavigateBack}
            disabled={isSubmitting}
            marginTop="$4"
            paddingVertical={0}
            paddingHorizontal="$2"
          >
            <TamaguiButton.Text color="$primary">Back to Sign In</TamaguiButton.Text>
          </TamaguiButton>
        </Column>
      </ScrollView>
    </Column>
  );
}
