/**
 * Theme Types and Hook - Cross-platform
 *
 * Type definitions are in this file. The actual hook implementation
 * is in platform-specific files that bundlers resolve automatically:
 * - useTheme.web.ts (web: uses @tamagui/next-theme)
 * - useTheme.native.ts (mobile: uses useColorScheme)
 *
 * Resolution:
 * - Metro (React Native): Automatically prefers .native.ts over .ts
 * - Webpack (Next.js): Configured to prefer .web.ts via resolve.extensions
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

// Re-export the hook from the native implementation as the default.
// Bundlers will override this with platform-specific files:
// - Metro uses useTheme.native.ts (automatic)
// - Webpack uses useTheme.web.ts (via resolve.extensions config)
export { useTheme } from "./useTheme.native";
