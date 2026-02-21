/**
 * Button Component
 *
 * Custom styled button with Figma-designed variants for consistent branding.
 * Supports cross-platform shadows with graceful degradation on mobile.
 *
 * Variants (via butterVariant prop):
 * - primary: Spiced Clementine (#F45314) - Main CTA, vibrant orange
 * - secondary: Light grey (#EDEDED) - Secondary actions, "Shop now", "Cancel"
 *
 * Both variants share the same pill shape and drop shadow for visual consistency.
 *
 * Note: Uses `butterVariant` prop instead of `variant` to avoid conflicts
 * with Tamagui's built-in Button variants.
 *
 * @example
 * ```tsx
 * <Button butterVariant="primary">Sell now</Button>
 * <Button butterVariant="secondary">Shop now</Button>
 * ```
 */

import React from "react";
import { Button as TamaguiButton, styled, GetProps, type ColorTokens } from "tamagui";
import { Platform } from "react-native";

/**
 * Unified drop shadow applied to all button variants.
 * Web: CSS boxShadow. Mobile: RN shadow props + Android elevation.
 */
const buttonShadow =
  Platform.OS === "web"
    ? {
        shadowColor: "rgba(0, 0, 0, 0.2)" as const,
        shadowOffset: { width: 0, height: 1 } as const,
        shadowRadius: 4 as const,
        elevation: 3 as const,
        boxShadow: "0px 1px 4px rgba(0, 0, 0, 0.2)",
      }
    : {
        shadowColor: "rgba(0, 0, 0, 0.2)" as const,
        shadowOffset: { width: 0, height: 1 } as const,
        shadowRadius: 4 as const,
        elevation: 3 as const,
      };

const ButtonBase = styled(TamaguiButton, {
  name: "Button",

  // Base styles for all buttons
  // Note: In Tamagui v2, font-related props (fontFamily, fontWeight) are not valid on the Button
  // frame (which extends Stack, not Text). To style button text, use <Button.Text> explicitly.
  cursor: "pointer",
  borderRadius: "$full",

  variants: {
    butterVariant: {
      primary: {
        backgroundColor: "$primary",
        borderWidth: 1,
        borderColor: "$primaryBorder",
        color: "$white", // Always white on orange, regardless of theme
        ...buttonShadow,

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
        // Light grey background - secondary actions, "Shop now", "Cancel"
        backgroundColor: "$cloudMist",
        borderWidth: 1,
        borderColor: "$border",
        color: "$text", // Dark text on light grey for good contrast
        ...buttonShadow,

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
    },
  } as const,

  defaultVariants: {
    butterVariant: "primary" as const,
  },
});


export type ButtonProps = GetProps<typeof ButtonBase> & { color?: ColorTokens | string };

/**
 * In Tamagui v2 the Button frame (which extends Stack/View) no longer exposes
 * `color` in its TypeScript type surface. The `color` prop is functional at
 * runtime via the shared ButtonContext — it flows to inner Button.Text children
 * — but the TS compiler reports "Property 'color' does not exist".
 *
 * The intersection cast below:
 *   1. Keeps `typeof ButtonBase` so all static sub-components (Apply, Text,
 *      Icon, Frame), styled-component helpers, and existing variant props are
 *      preserved exactly as-is.
 *   2. Overloads the call signature with `ButtonProps` which re-adds the
 *      `color` prop, making call-site usage type-safe.
 *   3. Uses `as unknown as` because TypeScript does not allow widening a
 *      forwardRef component's props via a direct cast; the double-hop through
 *      `unknown` is the established pattern for safe widening (not narrowing)
 *      when the runtime already supports the wider type.
 *
 * If Tamagui upstream restores `color` to the Button frame type this cast can
 * be removed without any call-site changes.
 */
export const Button = ButtonBase as unknown as typeof ButtonBase & {
  (
    props: ButtonProps & React.RefAttributes<React.ElementRef<typeof ButtonBase>>
  ): React.ReactElement | null;
};
