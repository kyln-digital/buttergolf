"use client";

import { useThemeSetting } from "@tamagui/next-theme";
import type { UseThemeResult, ThemeMode, ResolvedTheme } from "./useTheme";

/**
 * Web implementation of useTheme using @tamagui/next-theme
 *
 * This hook MUST be called within NextThemeProvider context.
 * If called outside the provider, it will log warnings to help with debugging.
 *
 * @example
 * ```tsx
 * function ThemeButton() {
 *   const { resolvedTheme, toggle, canToggle } = useTheme();
 *
 *   if (!canToggle) return null;
 *
 *   return (
 *     <Button onPress={toggle}>
 *       {resolvedTheme === 'light' ? <Moon /> : <Sun />}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeResult {
  // Call hook unconditionally at top level (React rules of hooks)
  const themeSetting = useThemeSetting();

  // Dev-only warnings for debugging
  if (process.env.NODE_ENV !== "production") {
    if (!themeSetting.toggle) {
      console.warn(
        "[useTheme] toggle function is undefined. " +
          "Make sure useTheme is called within NextThemeProvider context."
      );
    }
    if (!themeSetting.set) {
      console.warn(
        "[useTheme] set function is undefined. " +
          "Make sure useTheme is called within NextThemeProvider context."
      );
    }
  }

  // Map @tamagui/next-theme's interface to our unified interface
  return {
    mode: (themeSetting.current ?? "system") as ThemeMode,
    resolvedTheme: (themeSetting.resolvedTheme ?? "light") as ResolvedTheme,
    toggle: themeSetting.toggle,
    setMode: themeSetting.set,
    canToggle: true,
  };
}
