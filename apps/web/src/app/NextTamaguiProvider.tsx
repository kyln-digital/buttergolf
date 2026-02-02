"use client";

import { NextTamaguiProvider as BaseProvider } from "@buttergolf/app";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

/**
 * Web-specific provider wrapper
 *
 * IMPORTANT: Tamagui must be initialized BEFORE Clerk to prevent
 * "Missing theme" errors during hydration. Clerk's UserButton and
 * other components may render during React 19's concurrent hydration,
 * and they need Tamagui's theme context to be available.
 */
export function NextTamaguiProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <BaseProvider>
      <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
        {children}
      </ClerkProvider>
    </BaseProvider>
  );
}
