"use client";

/**
 * NextTamaguiProvider - Official Tamagui theme switching for Next.js App Router
 *
 * Uses @tamagui/next-theme as recommended in Tamagui docs:
 * https://tamagui.dev/docs/guides/next-js#themes
 *
 * Features:
 * - SSR-safe theme switching (NextThemeProvider handles hydration)
 * - System color scheme detection
 * - Theme persistence via localStorage (built into NextThemeProvider)
 * - Theme toggle UI via useThemeSetting() hook
 */

import "@tamagui/polyfill-dev";

import { type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { useServerInsertedHTML } from "next/navigation";
import { NextThemeProvider, useRootTheme } from "@tamagui/next-theme";
import { TamaguiProvider } from "tamagui";
import { config } from "@buttergolf/config";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * Inner provider that uses useRootTheme inside NextThemeProvider context
 * This fixes the circular dependency issue where useRootTheme must be
 * called within the NextThemeProvider's tree.
 */
function TamaguiProviderInner({ children }: { children: ReactNode }) {
  // useRootTheme MUST be inside NextThemeProvider's children
  // IMPORTANT: useRootTheme() can return undefined during SSR or before
  // the theme context is fully initialized (especially on slow devices/networks).
  // We MUST provide a fallback to prevent "Missing theme" errors.
  const [theme] = useRootTheme();

  return (
    <TamaguiProvider
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config={config as any}
      defaultTheme={theme ?? "light"}
      disableRootThemeClass // NextThemeProvider handles the class
    >
      {children}
    </TamaguiProvider>
  );
}

export function NextTamaguiProvider({ children }: Readonly<{ children: ReactNode }>) {
  // Inject styles for SSR (react-native-web components)
  useServerInsertedHTML(() => {
    // @ts-expect-error - RN doesn't have this type but it exists at runtime
    const rnwStyle = StyleSheet.getSheet();
    return (
      <>
        {/* Prevent theme flash on load by hiding until JS runs */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('t_unmounted')`,
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: rnwStyle.textContent }} id={rnwStyle.id} />
        <style
          dangerouslySetInnerHTML={{
            __html: config.getCSS({
              exclude: process.env.NODE_ENV === "production" ? "design-system" : null,
            }),
          }}
        />
      </>
    );
  });

  return (
    <NextThemeProvider
      skipNextHead // Required for App Router
      enableSystem // Enable system preference detection
      defaultTheme="system" // Default to system preference
    >
      <TamaguiProviderInner>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </TamaguiProviderInner>
    </NextThemeProvider>
  );
}
