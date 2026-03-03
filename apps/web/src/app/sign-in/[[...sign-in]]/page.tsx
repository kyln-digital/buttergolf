"use client";

import { SignIn } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { Column, Spinner, Text } from "@buttergolf/ui";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function SignInPage() {
  const { isSignedIn } = useAuth();
  const isRedirecting = Boolean(isSignedIn);

  return (
    <AuthLayout>
      <Column width="100%" minHeight={620} justifyContent="center">
        {isRedirecting ? (
          <Column alignItems="center" justifyContent="center" gap="$md" height="100%">
            <Spinner size="lg" color="$primary" />
            <Text size="$5" color="$textSecondary" textAlign="center">
              Signing you in...
            </Text>
          </Column>
        ) : (
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
        )}
      </Column>
    </AuthLayout>
  );
}
