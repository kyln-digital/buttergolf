"use client";

import { useColorScheme } from "react-native";
import type { UseThemeResult, ResolvedTheme } from "./useTheme";

/**
 * Native implementation of useTheme using React Native's useColorScheme
 *
 * On mobile, theme switching is controlled by system settings.
 * Users can change theme in device Settings > Display.
 * The canToggle flag is false, so theme switcher components can hide themselves.
 *
 * @example
 * ```tsx
 * function ThemeButton() {
 *   const { resolvedTheme, canToggle } = useTheme();
 *
 *   if (!canToggle) return null; // This will be true on mobile
 *
 *   // ...
 * }
 * ```
 */
export function useTheme(): UseThemeResult {
  // Call hook unconditionally at top level (React rules of hooks)
  const colorScheme = useColorScheme();

  // Validate colorScheme - default to light if null/undefined
  const resolvedTheme: ResolvedTheme = colorScheme === "dark" ? "dark" : "light";

  return {
    mode: "system", // Mobile always follows system
    resolvedTheme,
    toggle: () => {
      // On mobile, theme is controlled by system settings
      // UI components using canToggle should hide themselves,
      // so this should rarely be called. No-op by design.
    },
    setMode: () => {
      // Same as toggle - system controlled, no-op by design
    },
    canToggle: false, // Mobile follows system - UI should check this and hide toggle controls
  };
}
