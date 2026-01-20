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

export function NextTamaguiProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Official Tamagui pattern: useRootTheme() syncs with NextThemeProvider
  const [theme, setTheme] = useRootTheme();

  // Inject styles for SSR (react-native-web components)
  useServerInsertedHTML(() => {
    // @ts-ignore - RN doesn't have this type but it exists at runtime
    const rnwStyle = StyleSheet.getSheet();
    return (
      <>
        <style
          dangerouslySetInnerHTML={{ __html: rnwStyle.textContent }}
          id={rnwStyle.id}
        />
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
      // enableSystem // Enable system preference detection (default)
      // defaultTheme="system" // Default to system preference
      onChangeTheme={(next) => {
        setTheme(next as "light" | "dark");
      }}
    >
      <TamaguiProvider
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config={config as any}
        defaultTheme={theme}
        disableRootThemeClass // NextThemeProvider handles the class
      >
        {children}
      </TamaguiProvider>
    </NextThemeProvider>
  );
}
