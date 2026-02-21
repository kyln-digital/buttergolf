"use client";

import React, { useState, useCallback } from "react";
import { Column, Row, ScrollView, Text, Button, Heading, Spinner } from "@buttergolf/ui";
import { Button as TamaguiButton } from "tamagui";
import { ArrowLeft } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignUp } from "@clerk/clerk-expo";
import { AuthFormInput, AuthErrorDisplay } from "./components";
import { validateSignUpForm, getPasswordStrength, mapClerkErrorToMessage } from "./utils";
import { SignUpFormData, PasswordStrength } from "./types";

interface SignUpScreenProps {
  onSuccess?: (email: string) => void;
  onNavigateToSignIn?: () => void;
  onNavigateBack?: () => void;
}

/**
 * Sign-up screen with email/password registration
 * Includes password strength validation and verification email sending
 */
export function SignUpScreen({
  onSuccess,
  onNavigateToSignIn,
  onNavigateBack,
}: Readonly<SignUpScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signUp, isLoaded } = useSignUp();

  const [formData, setFormData] = useState<SignUpFormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>("weak");

  // Update password strength when password changes
  const handlePasswordChange = useCallback(
    (password: string) => {
      setFormData((prev) => ({ ...prev, password }));
      setPasswordStrength(getPasswordStrength(password));

      // Clear password error when user starts typing
      if (fieldErrors.password) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.password;
          return next;
        });
      }
    },
    [fieldErrors]
  );

  const handleFirstNameChange = useCallback(
    (firstName: string) => {
      setFormData((prev) => ({ ...prev, firstName }));
      if (fieldErrors.firstName) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.firstName;
          return next;
        });
      }
    },
    [fieldErrors]
  );

  const handleLastNameChange = useCallback(
    (lastName: string) => {
      setFormData((prev) => ({ ...prev, lastName }));
      if (fieldErrors.lastName) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.lastName;
          return next;
        });
      }
    },
    [fieldErrors]
  );

  const handleEmailChange = useCallback(
    (email: string) => {
      setFormData((prev) => ({ ...prev, email }));
      if (fieldErrors.email) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.email;
          return next;
        });
      }
    },
    [fieldErrors]
  );

  const handleConfirmPasswordChange = useCallback(
    (confirmPassword: string) => {
      setFormData((prev) => ({ ...prev, confirmPassword }));
      if (fieldErrors.confirmPassword) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.confirmPassword;
          return next;
        });
      }
    },
    [fieldErrors]
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate form
    const validation = validateSignUpForm(
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.password,
      formData.confirmPassword
    );

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    if (!isLoaded || !signUp) {
      setError("Authentication service not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the sign-up
      await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      // Prepare email verification
      await signUp.prepareEmailAddressVerification();

      // Call success to navigate to verify email screen with the email
      onSuccess?.(formData.email);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for Clerk-specific error codes
      if (errorMessage.includes("duplicate_identifier")) {
        setError(mapClerkErrorToMessage("duplicate_identifier"));
      } else if (errorMessage.includes("password_not_strong_enough")) {
        setError(mapClerkErrorToMessage("password_not_strong_enough"));
      } else {
        setError(errorMessage || "Sign-up failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isLoaded, signUp, onSuccess]);

  const getPasswordStrengthColor = (strength: PasswordStrength) => {
    switch (strength) {
      case "weak":
        return "$error";
      case "fair":
        return "$warning";
      case "good":
        return "$info";
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
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          minHeight: "100%",
        }}
      >
        <Column gap="$6" flex={1}>
          {/* Back Button and Header */}
          <Column gap="$3">
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

            <Column gap="$2">
              <Heading level={1} size="$8" fontWeight="700" color="$text">
                Create Account
              </Heading>
              <Text size="$5" color="$textSecondary">
                Join ButterGolf to buy and sell golf gear
              </Text>
            </Column>
          </Column>

          {/* Error Display */}
          {error && <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Form Fields */}
          <Column gap="$4">
            <AuthFormInput
              label="First Name"
              value={formData.firstName}
              onChangeText={handleFirstNameChange}
              placeholder="John"
              autoCapitalize="words"
              error={fieldErrors.firstName}
              editable={!isSubmitting}
              autoComplete="given-name"
            />

            <AuthFormInput
              label="Last Name"
              value={formData.lastName}
              onChangeText={handleLastNameChange}
              placeholder="Smith"
              autoCapitalize="words"
              error={fieldErrors.lastName}
              editable={!isSubmitting}
              autoComplete="family-name"
            />

            <AuthFormInput
              label="Email"
              value={formData.email}
              onChangeText={handleEmailChange}
              placeholder="your@email.com"
              type="email"
              error={fieldErrors.email}
              editable={!isSubmitting}
              autoComplete="email"
            />

            <Column gap="$2">
              <AuthFormInput
                label="Password"
                value={formData.password}
                onChangeText={handlePasswordChange}
                placeholder="••••••••"
                type="password"
                error={fieldErrors.password}
                editable={!isSubmitting}
                autoComplete="new-password"
              />

              {/* Password Strength Indicator */}
              {formData.password && (
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

              <Text size="$3" color="$textSecondary">
                Must include uppercase, lowercase, number, and special character
              </Text>
            </Column>

            <AuthFormInput
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              placeholder="••••••••"
              type="password"
              error={fieldErrors.confirmPassword}
              editable={!isSubmitting}
              autoComplete="new-password"
            />
          </Column>

          {/* Sign Up Button and Sign In Link */}
          <Column gap="$3">
            <Button
              butterVariant="primary"
              size="$5"
              borderRadius="$full"
              onPress={handleSubmit}
              disabled={isSubmitting || !isLoaded}
              opacity={isSubmitting ? 0.7 : 1}
            >
              {isSubmitting ? <Spinner size="sm" color="$textInverse" /> : "Create Account"}
            </Button>

            <Row alignItems="center" justifyContent="center" gap="$2">
              <Text size="$4" color="$textSecondary">
                Already have an account?
              </Text>
              <TamaguiButton
                chromeless
                size="$5"
                color="$primary"
                onPress={onNavigateToSignIn}
                disabled={isSubmitting}
                paddingVertical="$2"
                paddingHorizontal="$3"
              >
                Sign In
              </TamaguiButton>
            </Row>
          </Column>
        </Column>
      </ScrollView>
    </Column>
  );
}
