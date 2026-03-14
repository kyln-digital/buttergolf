"use client";

import React, { useState, useCallback } from "react";
import { Column, Row, ScrollView, Text, Button, Heading, Spinner } from "@buttergolf/ui";
import { View } from "tamagui";
import { ArrowLeft } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { AuthFormInput, AuthErrorDisplay } from "./components";
import { validateSignInForm, mapClerkErrorToMessage } from "./utils";
import { SignInFormData } from "./types";

interface SignInScreenProps {
  onSuccess?: () => void;
  onNavigateToSignUp?: () => void;
  onNavigateToForgotPassword?: () => void;
  onNavigateToTwoFactor?: () => void;
  onNavigateBack?: () => void;
}

/**
 * Sign-in screen with email/password authentication
 * and OAuth provider options (Google, Apple)
 */
export function SignInScreen({
  onSuccess,
  onNavigateToSignUp,
  onNavigateToForgotPassword,
  onNavigateToTwoFactor,
  onNavigateBack,
}: Readonly<SignInScreenProps>) {
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [formData, setFormData] = useState<SignInFormData>({
    email: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleEmailChange = useCallback(
    (email: string) => {
      setFormData((prev) => ({ ...prev, email }));
      // Clear email error when user starts typing
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

  const handlePasswordChange = useCallback(
    (password: string) => {
      setFormData((prev) => ({ ...prev, password }));
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

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate form
    const validation = validateSignInForm(formData.email, formData.password);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    if (!isLoaded || !signIn) {
      setError("Authentication service not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("[SignIn] Attempting sign-in for:", formData.email);
      const signInAttempt = await signIn.create({
        identifier: formData.email,
        password: formData.password,
      });
      console.log("[SignIn] Status:", signInAttempt.status);

      // Check status first - createdSessionId only exists when status is 'complete'
      if (signInAttempt.status === "complete") {
        console.log("[SignIn] Session created:", signInAttempt.createdSessionId);
        await setActive({ session: signInAttempt.createdSessionId });
        onSuccess?.();
      } else if (signInAttempt.status === "needs_second_factor") {
        // 2FA is enabled - navigate to 2FA screen
        console.log("[SignIn] 2FA detected, navigating to 2FA screen");
        if (onNavigateToTwoFactor) {
          onNavigateToTwoFactor();
        } else {
          setError(
            "Two-factor authentication is required but not configured. Please contact support."
          );
        }
      } else if (signInAttempt.status === "needs_first_factor") {
        // Need to provide first factor (shouldn't happen with password flow)
        setError("Authentication requires additional verification.");
      } else if (signInAttempt.status === "needs_new_password") {
        setError("You need to set a new password. Please use the forgot password flow.");
      } else {
        console.log("[SignIn] Unhandled status:", signInAttempt.status);
        setError(`Sign-in incomplete. Status: ${signInAttempt.status}`);
      }
    } catch (err) {
      console.error("[SignIn] Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for Clerk-specific error codes
      if (errorMessage.includes("identifier_not_found")) {
        setError(mapClerkErrorToMessage("identifier_not_found"));
      } else if (errorMessage.includes("password_incorrect")) {
        setError(mapClerkErrorToMessage("password_incorrect"));
      } else {
        setError(errorMessage || "Sign-in failed. Please check your credentials and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isLoaded, signIn, setActive, onSuccess]);

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

          {/* Header */}
          <Column gap="$2">
            <Heading level={1} size="$8" fontWeight="700" color="$text">
              Sign In
            </Heading>
            <Text size="$5" color="$textSecondary">
              Welcome back to ButterGolf
            </Text>
          </Column>

          {/* Error Display */}
          {error && <AuthErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Email/Password Form */}
          <Column gap="$4">
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

            <AuthFormInput
              label="Password"
              value={formData.password}
              onChangeText={handlePasswordChange}
              placeholder="••••••••"
              type="password"
              error={fieldErrors.password}
              editable={!isSubmitting}
              autoComplete="current-password"
            />

            {/* Forgot Password Link */}
            <Button
              chromeless
              size="$4"
              onPress={onNavigateToForgotPassword}
              disabled={isSubmitting}
              alignSelf="flex-start"
              paddingVertical={0}
              paddingHorizontal="$2"
            >
              <Button.Text color="$primary">Forgot password?</Button.Text>
            </Button>
          </Column>

          {/* Sign In Button */}
          <View position="relative">
            <Button
              butterVariant="primary"
              size="$5"
              borderRadius="$full"
              onPress={handleSubmit}
              disabled={isSubmitting || !isLoaded}
              opacity={isSubmitting ? 0.7 : 1}
            >
              <Text color="$textInverse" fontWeight="600" opacity={isSubmitting ? 0 : 1}>
                Sign In
              </Text>
            </Button>
            {isSubmitting && (
              <View
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                alignItems="center"
                justifyContent="center"
                pointerEvents="none"
              >
                <Spinner size="sm" color="$textInverse" />
              </View>
            )}
          </View>

          {/* Sign Up Link */}
          <Row alignItems="center" justifyContent="center" gap="$2" marginTop="$4">
            <Text size="$4" color="$textSecondary">
              {"Don't have an account?"}
            </Text>
            <Button
              chromeless
              size="$5"
              onPress={onNavigateToSignUp}
              disabled={isSubmitting}
              paddingVertical="$2"
              paddingHorizontal="$3"
            >
              <Button.Text color="$primary">Sign Up</Button.Text>
            </Button>
          </Row>
        </Column>
      </ScrollView>
    </Column>
  );
}
