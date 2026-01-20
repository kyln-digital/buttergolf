"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

// Theme options
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// Storage key for persisting theme preference
const THEME_STORAGE_KEY = "buttergolf-theme-preference";

// Context value type
interface ThemeContextValue {
  /** Current theme mode setting (light, dark, or system) */
  mode: ThemeMode;
  /** The resolved theme based on mode and system preference */
  resolvedTheme: ResolvedTheme;
  /** System color scheme preference */
  systemTheme: ResolvedTheme;
  /** Update the theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark (ignoring system) */
  toggle: () => void;
  /** Whether theme has been loaded from storage */
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Get system color scheme preference
 * On web: uses matchMedia for prefers-color-scheme
 * On native: defaults to light (native apps should use Appearance API separately)
 */
function getSystemTheme(): ResolvedTheme {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    return mediaQuery?.matches ? "dark" : "light";
  }
  // On native, we'll use React Native's Appearance API if available
  return "light";
}

/**
 * Resolve the actual theme based on mode and system preference
 */
function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  if (mode === "system") {
    return systemTheme;
  }
  return mode;
}

/**
 * Storage utilities - platform-agnostic
 */
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    // For React Native, we'll use AsyncStorage
    // This will be handled by the mobile app importing from @react-native-async-storage/async-storage
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore storage errors
      }
      return;
    }
    // For React Native
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  },
};

export interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme mode if none is stored */
  defaultMode?: ThemeMode;
  /** Force a specific theme (overrides user preference and system) */
  forcedTheme?: ResolvedTheme;
}

/**
 * ThemeProvider - Manages theme state with persistence and system preference detection
 *
 * Features:
 * - Persists theme preference to localStorage (web) or AsyncStorage (native)
 * - Detects system color scheme preference
 * - Supports light, dark, and system modes
 * - SSR-safe with hydration handling
 */
export function ThemeProvider({
  children,
  defaultMode = "system",
  forcedTheme,
}: ThemeProviderProps) {
  // Track if we've loaded from storage (for SSR hydration)
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Theme mode preference
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  
  // System theme preference
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  // Load stored preference and system theme on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Get system theme
      const system = getSystemTheme();
      
      // Get stored preference
      const stored = await storage.get(THEME_STORAGE_KEY);
      const validModes: ThemeMode[] = ["light", "dark", "system"];
      const storedMode = validModes.includes(stored as ThemeMode)
        ? (stored as ThemeMode)
        : defaultMode;

      if (mounted) {
        setSystemTheme(system);
        setModeState(storedMode);
        setIsLoaded(true);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [defaultMode]);

  // Listen for system theme changes (web only)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
    // Legacy browsers
    mediaQuery.addListener?.(handler);
    return () => mediaQuery.removeListener?.(handler);
  }, []);

  // Set mode with persistence
  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    await storage.set(THEME_STORAGE_KEY, newMode);
  }, []);

  // Toggle between light and dark
  const toggle = useCallback(() => {
    const newMode: ThemeMode = resolveTheme(mode, systemTheme) === "light" ? "dark" : "light";
    setMode(newMode);
  }, [mode, systemTheme, setMode]);

  // Compute resolved theme
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (forcedTheme) return forcedTheme;
    return resolveTheme(mode, systemTheme);
  }, [mode, systemTheme, forcedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      systemTheme,
      setMode,
      toggle,
      isLoaded,
    }),
    [mode, resolvedTheme, systemTheme, setMode, toggle, isLoaded]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { resolvedTheme, toggle, mode, setMode } = useThemeContext();
 *
 *   return (
 *     <Button onPress={toggle}>
 *       Current: {resolvedTheme}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Safe hook that returns defaults if used outside provider
 * Useful for components that may be rendered without theme context
 */
export function useThemeContextSafe(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: "light",
      resolvedTheme: "light",
      systemTheme: "light",
      setMode: () => {},
      toggle: () => {},
      isLoaded: true,
    };
  }
  return context;
}
