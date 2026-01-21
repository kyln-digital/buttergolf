/**
 * Button Component
 *
 * Custom styled button with Figma-designed variants for consistent branding.
 * Supports cross-platform shadows with graceful degradation on mobile.
 *
 * Variants (via butterVariant prop):
 * - primary: Spiced Clementine (#F45314) with inner glow (web only)
 * - secondary: Ironstone (#323232) with subtle inner shadow (web only)
 *
 * Both variants include drop shadows on all platforms.
 *
 * Note: Uses `butterVariant` prop instead of `variant` to avoid conflicts
 * with Tamagui's built-in Button variants.
 *
 * @example
 * ```tsx
 * <Button butterVariant="primary">Sell now</Button>
 * <Button butterVariant="secondary">Shop now</Button>
 * <Button butterVariant="primary" size="$4">Small primary button</Button>
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
const getButtonShadow = (variant: "primary" | "secondary" | "tertiary") => {
  const baseShadow = {
    shadowColor: "rgba(0, 0, 0, 0.25)" as const,
    shadowOffset: { width: 0, height: 1 } as const,
    shadowRadius: 5 as const,
    elevation: 3 as const, // Android shadow
  };

  if (Platform.OS === "web") {
    // Only the primary variant receives the inset glow on web.
    // Secondary should not have an inner inset to avoid unwanted coloration.
    if (variant === "primary") {
      // @ts-ignore - boxShadow only exists on web
      return {
        ...baseShadow,
        boxShadow: `0px 1px 5px rgba(0,0,0,0.25), inset 0px 2px 2px rgba(244, 83, 20, 0.3)`,
      };
    }

    if (variant === "tertiary") {
      // Tertiary (lighter) shadow
      // @ts-ignore - boxShadow only exists on web
      return {
        shadowColor: "rgba(0, 0, 0, 0.15)" as const,
        shadowOffset: { width: 0, height: 1 } as const,
        shadowRadius: 3 as const,
        elevation: 2 as const,
        boxShadow: `0px 1px 3px rgba(0, 0, 0, 0.15)`,
      };
    }

    // Secondary: keep drop shadow only (no inset)
    // @ts-ignore - boxShadow only exists on web
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
        color: "$textInverse",
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
        backgroundColor: "$secondary",
        borderWidth: 1,
        borderColor: "$secondaryBorder",
        color: "$textInverse",
        ...getButtonShadow("secondary"),

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

      tertiary: {
        backgroundColor: "$cloudMist",
        borderWidth: 0, // No border for pill style
        color: "$ironstone",
        ...getButtonShadow("tertiary"),

        hoverStyle: {
          backgroundColor: "$cloudMist", // Or slightly darker? AuthButton used cloudMist with opacity
          opacity: 0.85,
        },

        pressStyle: {
          backgroundColor: "$cloudMist",
          opacity: 0.75,
          scale: 0.98,
        },

        focusStyle: {
          backgroundColor: "$cloudMist",
          borderWidth: 2,
          borderColor: "$border",
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
