"use client";

import React, { useState, useCallback } from "react";
import {
  Column,
  ScrollView,
  Text,
  Button,
  Button as TamaguiButton,
  Heading,
  Row,
  Spinner,
} from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { AuthFormInput, AuthErrorDisplay } from "./components";
import {
  validateVerificationCode,
  validatePassword,
  validatePasswordMatch,
  getPasswordStrength,
  mapClerkErrorToMessage,
} from "./utils";
import { PasswordStrength } from "./types";

interface ResetPasswordScreenProps {
  email?: string;
  onSuccess?: () => void;
  onNavigateBack?: () => void;
}

/**
 * Reset password screen
 * User enters reset code and new password
 */
export function ResetPasswordScreen({
  email,
  onSuccess,
  onNavigateBack,
}: Readonly<ResetPasswordScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>("weak");

  const handleCodeChange = useCallback(
    (newCode: string) => {
      const sanitized = newCode.replace(/[^0-9]/g, "").slice(0, 6);
      setCode(sanitized);
      if (codeError) setCodeError(null);
    },
    [codeError]
  );

  const handlePasswordChange = useCallback(
    (pwd: string) => {
      setNewPassword(pwd);
      setPasswordStrength(getPasswordStrength(pwd));
      if (passwordError) setPasswordError(null);
    },
    [passwordError]
  );

  const handleConfirmPasswordChange = useCallback(
    (pwd: string) => {
      setConfirmPassword(pwd);
      if (confirmPasswordError) setConfirmPasswordError(null);
    },
    [confirmPasswordError]
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate code
    const codeValidationError = validateVerificationCode(code);
    if (codeValidationError) {
      setCodeError(codeValidationError);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid && passwordValidation.error) {
      setPasswordError(passwordValidation.error);
      return;
    }

    // Validate password match
    const matchError = validatePasswordMatch(newPassword, confirmPassword);
    if (matchError) {
      setConfirmPasswordError(matchError);
      return;
    }

    if (!isLoaded || !signIn) {
      setError("Authentication service not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Attempt password reset with code and new password
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (signIn as any).resetPassword({
        code,
        password: newPassword,
      });

      if (result?.createdSessionId) {
        // Password reset successful, create session
        await setActive({ session: result.createdSessionId });
        onSuccess?.();
      } else {
        setError("Password reset incomplete. Please try again.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes("verification_code_invalid")) {
        setCodeError(mapClerkErrorToMessage("verification_code_invalid"));
      } else if (errorMessage.includes("password_not_strong_enough")) {
        setPasswordError(mapClerkErrorToMessage("password_not_strong_enough"));
      } else {
        setError(errorMessage || "Password reset failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [code, newPassword, confirmPassword, isLoaded, signIn, setActive, onSuccess]);

  const getPasswordStrengthColor = (strength: PasswordStrength) => {
    switch (strength) {
      case "weak":
        return "$error";
      case "fair":
        return "$warning";
      case "good":
        return "$secondary";
      case "strong":
        return "$success";
    }
  };

  const getPasswordStrengthLabel = (strength: PasswordStrength) => {
    switch (strength) {
      case "weak":
        return "Weak";
      case "fair":
        return "Fair";
      case "good":
        return "Good";
      case "strong":
        return "Strong";
    }
  };

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
              Create New Password
            </Heading>
            <Text size="$5" color="$textSecondary">
              {email ? `Reset password for ${email}` : "Enter the code and your new password"}
            </Text>
          </Column>

          {/* Error Display */}
          {error && <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Form Fields */}
          <Column gap="$4">
            {/* Reset Code */}
            <AuthFormInput
              label="Reset Code"
              value={code}
              onChangeText={handleCodeChange}
              placeholder="000000"
              keyboardType="numeric"
              error={codeError}
              editable={!isSubmitting}
            />

            {/* New Password */}
            <Column gap="$2">
              <AuthFormInput
                label="New Password"
                value={newPassword}
                onChangeText={handlePasswordChange}
                placeholder="••••••••"
                secureTextEntry
                error={passwordError}
                editable={!isSubmitting}
              />

              {/* Password Strength Indicator */}
              {newPassword && (
                <Row gap="$2" alignItems="center">
                  <Row
                    flex={1}
                    height={4}
                    backgroundColor="$border"
                    borderRadius="$full"
                    overflow="hidden"
                  >
                    <Column
                      height="100%"
                      backgroundColor={getPasswordStrengthColor(passwordStrength)}
                      width={
                        passwordStrength === "weak"
                          ? "25%"
                          : passwordStrength === "fair"
                            ? "50%"
                            : passwordStrength === "good"
                              ? "75%"
                              : "100%"
                      }
                    />
                  </Row>
                  <Text
                    size="$3"
                    color={getPasswordStrengthColor(passwordStrength)}
                    fontWeight="600"
                  >
                    {getPasswordStrengthLabel(passwordStrength)}
                  </Text>
                </Row>
              )}

              <Text size="$3" color="$textMuted">
                Must include uppercase, lowercase, number, and special character
              </Text>
            </Column>

            {/* Confirm Password */}
            <AuthFormInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              placeholder="••••••••"
              secureTextEntry
              error={confirmPasswordError}
              editable={!isSubmitting}
            />
          </Column>

          {/* Submit Button */}
          <Button
            butterVariant="primary"
            size="$5"
            borderRadius="$full"
            fontWeight="600"
            onPress={handleSubmit}
            disabled={isSubmitting || !isLoaded || code.length !== 6}
            opacity={isSubmitting || code.length !== 6 ? 0.7 : 1}
          >
            {isSubmitting ? <Spinner size="sm" color="$textInverse" /> : "Reset Password"}
          </Button>

          {/* Back Button */}
          <TamaguiButton
            chromeless
            size="$4"
            color="$primary"
            fontWeight="600"
            onPress={onNavigateBack}
            disabled={isSubmitting}
            marginTop="$4"
            paddingVertical={0}
            paddingHorizontal="$2"
          >
            Back
          </TamaguiButton>
        </Column>
      </ScrollView>
    </Column>
  );
}
