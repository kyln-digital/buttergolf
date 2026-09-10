"use client";

import { NextTamaguiProvider as BaseProvider } from "@buttergolf/app";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { brandColors } from "@buttergolf/config";
import { usePathname } from "next/navigation";
import { FavouritesProvider } from "../providers/FavouritesProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";

/**
 * Web-specific provider wrapper
 *
 * IMPORTANT: Tamagui must be initialized BEFORE Clerk to prevent
 * "Missing theme" errors during hydration. Clerk's UserButton and
 * other components may render during React 19's concurrent hydration,
 * and they need Tamagui's theme context to be available.
 *
 * Routes that use neither Tamagui nor Clerk (e.g. /coming-soon) skip
 * ClerkProvider entirely to avoid the race condition where Clerk's
 * internal components access Tamagui context before it's ready.
 * (Fixes BUTTERGOLF-3)
 */

/**
 * Clerk's hosted forms styled to the ButterGolf button family: brand orange
 * primary, pill buttons, Urbanist type. Raw colour values are required here
 * because Clerk reads plain CSS values, not theme tokens.
 */
const clerkAppearance = {
  variables: {
    colorPrimary: brandColors.spicedClementine,
    colorText: brandColors.ironstone,
    colorTextSecondary: brandColors.slateSmoke,
    colorDanger: brandColors.errorBase,
    colorSuccess: brandColors.successBase,
    colorInputText: brandColors.ironstone,
    colorInputBackground: brandColors.pureWhite,
    fontFamily: "Urbanist, -apple-system, system-ui, BlinkMacSystemFont, sans-serif",
    fontSize: "15px",
    borderRadius: "10px",
  },
  elements: {
    card: { boxShadow: "none", border: `1px solid ${brandColors.cloudMist}` },
    formButtonPrimary: {
      borderRadius: "9999px",
      fontWeight: 600,
      fontSize: "15px",
      boxShadow: "none",
      textTransform: "none",
    },
    socialButtonsBlockButton: { borderRadius: "9999px", fontWeight: 600 },
    formFieldInput: { borderRadius: "9999px" },
    footerActionLink: { color: brandColors.spicedClementine, fontWeight: 600 },
  },
};

/** Routes that should not load ClerkProvider (plain HTML pages with no auth) */
const CLERK_EXCLUDED_ROUTES = ["/coming-soon"];

export function NextTamaguiProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const skipClerk = CLERK_EXCLUDED_ROUTES.includes(pathname);

  return (
    <BaseProvider>
      {skipClerk ? (
        children
      ) : (
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          proxyUrl={process.env.NEXT_PUBLIC_CLERK_PROXY_URL || undefined}
          appearance={clerkAppearance}
        >
          <ErrorBoundary name="FavouritesProvider">
            <FavouritesProvider>{children}</FavouritesProvider>
          </ErrorBoundary>
        </ClerkProvider>
      )}
    </BaseProvider>
  );
}
