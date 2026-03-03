/**
 * Button Component
 *
 * Custom styled button with Figma-designed variants for consistent branding.
 * Supports cross-platform shadows with graceful degradation on mobile.
 *
 * Variants (via butterVariant prop):
 * - primary: Spiced Clementine (#F45314) - Main CTA, vibrant orange
 * - secondary: Light grey (#EDEDED) - Secondary actions, "Shop now", "Cancel"
 * - icon: Neutral flat icon button - no shadow, grey border, orange on hover/active
 *
 * Both primary and secondary variants share the same pill shape and drop shadow.
 * The icon variant is shadow-free and intended for circular icon-only buttons.
 *
 * Note: Uses `butterVariant` prop instead of `variant` to avoid conflicts
 * with Tamagui's built-in Button variants.
 *
 * @example
 * ```tsx
 * <Button butterVariant="primary">Sell now</Button>
 * <Button butterVariant="secondary">Shop now</Button>
 * <Button butterVariant="icon" circular width={44} height={44} padding={0}>
 *   <Heart size={22} />
 * </Button>
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
        backgroundColor: "$controlSecondaryBg",
        borderWidth: 1,
        borderColor: "$controlSecondaryBg",
        color: "$controlSecondaryText",
        ...buttonShadow,

        hoverStyle: {
          backgroundColor: "$controlSecondaryBgHover",
          borderColor: "$controlSecondaryBgHover",
        },

        pressStyle: {
          backgroundColor: "$controlSecondaryBgPress",
          borderColor: "$controlSecondaryBgPress",
          scale: 0.98,
        },

        focusStyle: {
          borderColor: "$borderFocus",
          outlineColor: "$borderFocus",
          outlineWidth: 2,
        },
      },

      icon: {
        // Neutral flat icon button - no shadow, reveals brand colour on interaction
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: "$border",
        color: "$textSecondary",
        // No shadow - icon buttons are secondary controls, not elevated CTAs

        hoverStyle: {
          borderColor: "$primary",
          backgroundColor: "$primaryLight",
        },

        pressStyle: {
          scale: 0.95,
          opacity: 0.85,
        },

        focusStyle: {
          borderColor: "$borderFocus",
          outlineColor: "$borderFocus",
          outlineWidth: 2,
        },
      },
    },
  } as const,
});

export type ButtonProps = GetProps<typeof ButtonBase>;

/**
 * When `chromeless` is passed without an explicit `butterVariant`,
 * skip the default primary variant so chromeless styling is not overridden.
 * Also skip the default for `unstyled` buttons so custom surface styles are respected.
 * Otherwise, default to `butterVariant="primary"` for backward compatibility.
 */
export const Button = ButtonBase.styleable<ButtonProps>((props, ref) => {
  const butterVariant =
    props.butterVariant ?? (props.chromeless || props.unstyled ? undefined : "primary");
  return <ButtonBase ref={ref} {...props} butterVariant={butterVariant} />;
});
