"use client";

import { Platform } from "react-native";

/**
 * Theme types shared across platforms
 */
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Unified theme hook interface
 * Works on both web (via useThemeSetting) and mobile (via useColorScheme)
 */
export interface UseThemeResult {
  /** Current theme mode setting (light, dark, or system) */
  mode: ThemeMode;
  /** The resolved theme based on mode and system preference */
  resolvedTheme: ResolvedTheme;
  /** Toggle between light and dark */
  toggle: () => void;
  /** Set a specific mode */
  setMode: (mode: ThemeMode) => void;
  /** Whether user can manually switch themes (mobile follows system) */
  canToggle: boolean;
}

/**
 * Platform-aware theme hook
 * 
 * On web: Uses @tamagui/next-theme's useThemeSetting for SSR-safe theme switching
 * On mobile: Uses React Native's useColorScheme (system-controlled, no manual toggle)
 * 
 * @example
 * ```tsx
 * function ThemeButton() {
 *   const { resolvedTheme, toggle, canToggle } = useTheme();
 *   
 *   if (!canToggle) return null; // Mobile - system controlled
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
  if (Platform.OS === "web") {
    // Web: use @tamagui/next-theme
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useThemeSetting } = require("@tamagui/next-theme");
    const themeSetting = useThemeSetting();
    
    return {
      mode: (themeSetting.current || "system") as ThemeMode,
      resolvedTheme: (themeSetting.resolvedTheme || "light") as ResolvedTheme,
      toggle: themeSetting.toggle || (() => {}),
      setMode: themeSetting.set || (() => {}),
      canToggle: true,
    };
  }
  
  // Mobile: use React Native's useColorScheme
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useColorScheme } = require("react-native");
  const colorScheme = useColorScheme();
  
  return {
    mode: "system", // Mobile always follows system
    resolvedTheme: (colorScheme || "light") as ResolvedTheme,
    toggle: () => {
      // On mobile, theme is controlled by system settings
      // Could show an alert directing user to system settings
      console.log("Theme is controlled by system settings on mobile");
    },
    setMode: () => {
      console.log("Theme is controlled by system settings on mobile");
    },
    canToggle: false, // Mobile follows system
  };
}
