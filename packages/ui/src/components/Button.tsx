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

import { Button as TamaguiButton, styled, GetProps } from "tamagui";
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
  // @ts-expect-error -- tamagui v2: fontFamily removed from ButtonStyledContext default variants; tracked in docs/tamagui-v2-migration.md bucket 5
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

export const Button = ButtonBase;
export type ButtonProps = GetProps<typeof ButtonBase>;
