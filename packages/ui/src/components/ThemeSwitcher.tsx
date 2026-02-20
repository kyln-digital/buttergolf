"use client";

import { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "@tamagui/lucide-icons";
import { XStack, SizableText, Button, styled, type GetProps } from "tamagui";
import { useTheme, type ThemeMode } from "@buttergolf/app/src/hooks/useTheme";

/**
 * Theme mode options configuration
 */
const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Moon }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
];

// Styled container using XStack directly
const Row = styled(XStack, {
  name: "ThemeSwitcherRow",
});

// Styled text using SizableText (has proper size prop)
const Text = styled(SizableText, {
  name: "ThemeSwitcherText",
});

// Styled toggle button for theme selection
const ToggleButton = styled(XStack, {
  name: "ThemeToggleButton",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderRadius: "$md",
  cursor: "pointer",
  gap: "$2",
  minWidth: 44,
  minHeight: 44,

  variants: {
    active: {
      true: {
        backgroundColor: "$primary",
      },
      false: {
        backgroundColor: "transparent",
        hoverStyle: {
          backgroundColor: "$backgroundHover",
        },
      },
    },
  } as const,

  defaultVariants: {
    active: false,
  },
});

export type ThemeSwitcherProps = GetProps<typeof XStack> & {
  /** Show labels next to icons */
  showLabels?: boolean;
  /** Compact mode - single toggle button */
  compact?: boolean;
  /** Callback when theme changes */
  onThemeChange?: (mode: ThemeMode) => void;
};

/**
 * ThemeSwitcher - Full segmented control for theme selection
 *
 * Shows Light / Dark / System options in a pill-shaped control.
 * Use this in settings pages or menus.
 *
 * @example
 * ```tsx
 * <ThemeSwitcher showLabels />
 * ```
 */
export function ThemeSwitcher({
  showLabels = false,
  compact = false,
  onThemeChange,
  ...props
}: ThemeSwitcherProps) {
  const { mode: currentMode, setMode, toggle, canToggle } = useTheme();

  // On mobile, theme is system-controlled - don't show switcher
  if (!canToggle) {
    return null;
  }

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
    onThemeChange?.(newMode);
  };

  // Compact mode: single button that toggles light/dark
  if (compact) {
    return <ThemeToggleButton onPress={toggle} onThemeChange={onThemeChange} />;
  }

  // Full mode: segmented control
  return (
    <Row
      backgroundColor="$surface"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      padding="$1"
      gap="$1"
      {...props}
    >
      {THEME_OPTIONS.map(({ mode: optionMode, label, Icon }) => {
        const isActive = currentMode === optionMode;
        return (
          <ToggleButton
            key={optionMode}
            active={isActive}
            onPress={() => handleModeChange(optionMode)}
            role="button"
            aria-selected={isActive}
            aria-label={`Set theme to ${label}`}
          >
            <Icon size={18} color={isActive ? "$textInverse" : "$text"} />
            {showLabels && (
              <Text
                size="$4"
                color={isActive ? "$textInverse" : "$text"}
                fontWeight={isActive ? "600" : "400"}
              >
                {label}
              </Text>
            )}
          </ToggleButton>
        );
      })}
    </Row>
  );
}

export type ThemeToggleButtonProps = GetProps<typeof Button> & {
  /** Size of the icon */
  iconSize?: number;
  /** Callback when theme changes */
  onThemeChange?: (mode: ThemeMode) => void;
};

/**
 * ThemeToggleButton - Single button that toggles between light and dark
 *
 * Shows Sun icon in dark mode, Moon icon in light mode.
 * Use this in headers or tight spaces.
 *
 * @example
 * ```tsx
 * <ThemeToggleButton />
 * ```
 */
export function ThemeToggleButton({
  iconSize = 20,
  onThemeChange,
  ...props
}: ThemeToggleButtonProps) {
  const { resolvedTheme, toggle, canToggle } = useTheme();

  // Defer theme-dependent rendering until after hydration to prevent
  // server/client mismatch (Fixes BUTTERGOLF-1, BUTTERGOLF-4)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // On mobile, theme is system-controlled - don't show toggle button
  if (!canToggle) {
    return null;
  }

  const handleToggle = () => {
    const nextTheme: ThemeMode = resolvedTheme === "light" ? "dark" : "light";
    toggle();
    onThemeChange?.(nextTheme);
  };

  // Show opposite icon (what clicking will switch TO)
  const Icon = resolvedTheme === "light" ? Moon : Sun;
  const label = resolvedTheme === "light" ? "Switch to dark mode" : "Switch to light mode";

  // Render a placeholder with identical dimensions before mount
  // to prevent layout shift while avoiding hydration mismatch
  if (!mounted) {
    return (
      <Button chromeless circular size="$4" role="button" aria-hidden {...props}>
        <Sun size={iconSize} color="$text" style={{ opacity: 0 }} />
      </Button>
    );
  }

  return (
    <Button
      chromeless
      circular
      size="$4"
      onPress={handleToggle}
      aria-label={label}
      role="button"
      {...props}
    >
      <Icon size={iconSize} color="$text" />
    </Button>
  );
}
