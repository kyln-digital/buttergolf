"use client";

import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </AuthLayout>
  );
}
