// Import config BEFORE importing TamaguiProvider to ensure createTamagui runs first
import { config } from "@buttergolf/config";
import type { PropsWithChildren } from "react";
import { TamaguiProvider, type TamaguiProviderProps } from "tamagui";

export type ProviderProps = PropsWithChildren<
  Omit<TamaguiProviderProps, "config" | "children"> & {
    defaultTheme?: string;
  }
>;

// Valid base themes that exist in our Tamagui config
const VALID_THEMES = ["light", "dark"] as const;

export function Provider({ defaultTheme, children, ...rest }: ProviderProps) {
  // CRITICAL: Do NOT use useColorScheme() here - it causes SSR hydration mismatch!
  //
  // The problem:
  // 1. Server renders with theme="light" (useColorScheme returns null on server)
  // 2. Client hydrates with theme="dark" (if device is in dark mode)
  // 3. React detects mismatch, throws away DOM, tries to re-render
  // 4. Re-render fails with "Missing theme" error
  // 5. User sees: page loads → content vanishes after 0.5s → error
  //
  // Fix: Trust the defaultTheme prop exclusively. For web, NextTamaguiProvider
  // passes defaultTheme="light" (hardcoded for v1). For mobile, the native app
  // can pass whatever theme it wants based on device settings.
  //
  // Theme switching on web should be handled via NextThemeProvider when enabled,
  // which properly handles SSR hydration via useRootTheme().

  // Validate theme - must be deterministic for SSR (no device preference reading)
  const isValidTheme =
    defaultTheme && VALID_THEMES.includes(defaultTheme as (typeof VALID_THEMES)[number]);
  const theme = isValidTheme ? defaultTheme : "light";

  return (
    <TamaguiProvider
      // Type assertion required due to React Native version conflicts in monorepo:
      // - packages/app uses RN 0.82.1 (from Expo SDK 54)
      // - packages/ui uses RN 0.81.5 (peer dependency)
      // This creates incompatible StackProps types in defaultProps.
      // The config is valid at runtime - only type checking fails.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config={config as any}
      defaultTheme={theme}
      {...rest}
    >
      {children}
    </TamaguiProvider>
  );
}
