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
    try {
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
    } catch (error) {
      // Fallback if theme provider not available
      return {
        mode: "light",
        resolvedTheme: "light",
        toggle: () => {},
        setMode: () => {},
        canToggle: false,
      };
    }
  }
  
  // Mobile: use React Native's useColorScheme
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useColorScheme } = require("react-native");
    const colorScheme = useColorScheme();
    
    // Validate colorScheme is a valid value
    const validScheme = colorScheme === "dark" || colorScheme === "light" ? colorScheme : "light";
    
    return {
      mode: "system", // Mobile always follows system
      resolvedTheme: validScheme as ResolvedTheme,
      toggle: () => {
        // On mobile, theme is controlled by system settings
        // Users can change theme in device Settings > Display
      },
      setMode: () => {
        // On mobile, theme is controlled by system settings
        // Users can change theme in device Settings > Display
      },
      canToggle: false, // Mobile follows system
    };
  } catch (error) {
    // Fallback if useColorScheme not available
    return {
      mode: "light",
      resolvedTheme: "light",
      toggle: () => {},
      setMode: () => {},
      canToggle: false,
    };
  }
}
