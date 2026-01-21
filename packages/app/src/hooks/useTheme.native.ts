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
      // This is intentionally a no-op
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[useTheme] toggle called on mobile - theme is system-controlled. " +
            "Users can change theme in device Settings > Display."
        );
      }
    },
    setMode: () => {
      // Same as toggle - system controlled
      if (process.env.NODE_ENV !== "production") {
        console.info("[useTheme] setMode called on mobile - theme is system-controlled.");
      }
    },
    canToggle: false, // Mobile follows system
  };
}
