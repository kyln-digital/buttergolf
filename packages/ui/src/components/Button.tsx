/**
 * Button Component
 *
 * Custom styled button with Figma-designed variants for consistent branding.
 * Supports cross-platform shadows with graceful degradation on mobile.
 *
 * Variants (via butterVariant prop):
 * - primary: Spiced Clementine (#F45314) - Main CTA, vibrant orange
 * - secondary: Light grey (#EDEDED) - Secondary actions, "Skip", "Cancel"
 * - dark: Burnt Olive (#3E3B2C) - Dark button for special cases
 *
 * Both primary and dark variants include drop shadows on all platforms.
 *
 * Note: Uses `butterVariant` prop instead of `variant` to avoid conflicts
 * with Tamagui's built-in Button variants.
 *
 * @example
 * ```tsx
 * <Button butterVariant="primary">Sell now</Button>
 * <Button butterVariant="secondary">Skip for now</Button>
 * <Button butterVariant="dark">Shop now</Button>
 * ```
 */

import { Button as TamaguiButton, styled, GetProps } from "tamagui";
import { Platform } from "react-native";

/**
 * Helper: Get platform-specific shadow styles
 *
 * Web: Combines drop shadow + inner shadow via boxShadow
 * Mobile: Only drop shadow via shadowColor/shadowOffset/shadowRadius/elevation
 */
const getButtonShadow = (variant: "primary" | "secondary" | "dark") => {
  const baseShadow = {
    shadowColor: "rgba(0, 0, 0, 0.25)" as const,
    shadowOffset: { width: 0, height: 1 } as const,
    shadowRadius: 5 as const,
    elevation: 3 as const, // Android shadow
  };

  if (Platform.OS === "web") {
    // Only the primary variant receives the inset glow on web.
    if (variant === "primary") {
      return {
        ...baseShadow,
        boxShadow: `0px 1px 5px rgba(0,0,0,0.25), inset 0px 2px 2px rgba(244, 83, 20, 0.3)`,
      };
    }

    if (variant === "secondary") {
      // Secondary: subtle shadow for light grey button
      return {
        shadowColor: "rgba(0, 0, 0, 0.15)" as const,
        shadowOffset: { width: 0, height: 1 } as const,
        shadowRadius: 3 as const,
        elevation: 2 as const,
        boxShadow: `0px 1px 3px rgba(0, 0, 0, 0.15)`,
      };
    }

    // Dark: keep drop shadow only (no inset)
    return {
      ...baseShadow,
      boxShadow: `0px 1px 5px rgba(0,0,0,0.25)`,
    };
  }

  // Mobile: gracefully degrade to drop shadow only
  return baseShadow;
};

const ButtonBase = styled(TamaguiButton, {
  name: "Button",

  // Base styles for all buttons
  fontFamily: "$body",
  fontWeight: "700",
  cursor: "pointer",
  borderRadius: "$full",

  variants: {
    butterVariant: {
      primary: {
        backgroundColor: "$primary",
        borderWidth: 1,
        borderColor: "$primaryBorder",
        color: "$white", // Always white on orange, regardless of theme
        ...getButtonShadow("primary"),

        hoverStyle: {
          backgroundColor: "$primaryHover",
          borderColor: "$primaryBorder",
        },

        pressStyle: {
          backgroundColor: "$primaryPress",
          borderColor: "$primaryBorder",
          scale: 0.98,
        },

        focusStyle: {
          borderColor: "$primaryFocus",
          outlineColor: "$primaryFocus",
          outlineWidth: 2,
        },
      },

      secondary: {
        // Light grey background - perfect for "Skip", "Cancel", secondary actions
        backgroundColor: "$cloudMist",
        borderWidth: 1,
        borderColor: "$border",
        color: "$text", // Dark text on light grey for good contrast
        ...getButtonShadow("secondary"),

        hoverStyle: {
          backgroundColor: "$cloudMistHover",
          borderColor: "$borderHover",
        },

        pressStyle: {
          backgroundColor: "$cloudMistPress",
          borderColor: "$border",
          scale: 0.98,
        },

        focusStyle: {
          borderColor: "$borderFocus",
          outlineColor: "$borderFocus",
          outlineWidth: 2,
        },
      },

      dark: {
        // Dark button variant (Burnt Olive) - for special cases
        backgroundColor: "$secondary",
        borderWidth: 1,
        borderColor: "$secondaryBorder",
        color: "$textInverse",
        ...getButtonShadow("dark"),

        hoverStyle: {
          backgroundColor: "$secondaryHover",
          borderColor: "$secondaryBorder",
        },

        pressStyle: {
          backgroundColor: "$secondaryPress",
          borderColor: "$secondaryBorder",
          scale: 0.98,
        },

        focusStyle: {
          borderColor: "$secondaryFocus",
          outlineColor: "$secondaryFocus",
          outlineWidth: 2,
        },
      },
    },
  } as const,

  defaultVariants: {
    butterVariant: "primary" as const,
  },
});

export const Button = ButtonBase;
export type ButtonProps = GetProps<typeof ButtonBase>;
