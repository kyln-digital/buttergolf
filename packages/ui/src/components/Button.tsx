/**
 * Button Component
 *
 * ButterGolf's cross-platform button. Built directly on a styled stack (not on
 * Tamagui's own `Button`) so that hover / press / focus styles compile to real
 * CSS on web. Tamagui's `ButtonFrame` forces `disableClassName`, and wrapping it
 * in another `styled()` silently dropped every interaction style - the buttons
 * looked dead. This implementation keeps the familiar API (`icon`, `iconAfter`,
 * `circular`, `chromeless`, `unstyled`, `size`, text props) via `useButton`.
 *
 * Variants (via `butterVariant`):
 * - primary:   Spiced Clementine fill, white text, tinted lift shadow. Main CTA.
 * - secondary: Surface fill with a 1.5px outline, warms to Vanilla Cream on hover.
 * - ghost:     Text-only, subtle brand tint on hover. Nav links, tertiary actions.
 * - icon:      Outlined circular control for icon-only buttons (wishlist etc).
 *
 * Sizes map to a compact geometric scale (height / text):
 *   $1 28/12 · $2 32/13 · $3 36/14 · $4 40/15 · $4.5 44/15 · $5 48/16 · $6 56/18
 *
 * @example
 * ```tsx
 * <Button butterVariant="primary" size="$5">Sell now</Button>
 * <Button butterVariant="secondary" size="$5">Shop now</Button>
 * <Button butterVariant="ghost" icon={Heart}>Wishlist</Button>
 * <Button butterVariant="ghost" circular size="$4" aria-label="Menu"><MenuIcon /></Button>
 * ```
 */

import type { ReactNode } from "react";
import { Platform } from "react-native";
import {
  SizableText,
  ThemeableStack,
  createStyledContext,
  styled,
  useButton,
  withStaticProperties,
  type ButtonProps as TamaguiButtonProps,
  type ColorTokens,
  type GetProps,
  type SizeTokens,
} from "tamagui";

export type ButterVariant = "primary" | "secondary" | "ghost" | "icon";

interface ButtonMetrics {
  height: number;
  fontSize: number;
  lineHeight: number;
  paddingHorizontal: number;
}

const DEFAULT_SIZE = "$4";
const DEFAULT_METRICS: ButtonMetrics = {
  height: 40,
  fontSize: 15,
  lineHeight: 20,
  paddingHorizontal: 18,
};

/** Geometric scale shared by the frame (height/padding) and the label (type). */
const BUTTON_METRICS: Record<string, ButtonMetrics> = {
  $1: { height: 28, fontSize: 12, lineHeight: 16, paddingHorizontal: 10 },
  $2: { height: 32, fontSize: 13, lineHeight: 16, paddingHorizontal: 12 },
  $3: { height: 36, fontSize: 14, lineHeight: 18, paddingHorizontal: 16 },
  $4: DEFAULT_METRICS,
  "$4.5": { height: 44, fontSize: 15, lineHeight: 20, paddingHorizontal: 20 },
  $5: { height: 48, fontSize: 16, lineHeight: 22, paddingHorizontal: 24 },
  $6: { height: 56, fontSize: 18, lineHeight: 24, paddingHorizontal: 28 },
};

function getButtonMetrics(size: unknown): ButtonMetrics {
  if (typeof size === "number") {
    const fontSize = Math.round(size * 0.38);
    return {
      height: size,
      fontSize,
      lineHeight: Math.round(fontSize * 1.35),
      paddingHorizontal: Math.round(size * 0.45),
    };
  }
  const key = String(size ?? DEFAULT_SIZE);
  return BUTTON_METRICS[key] ?? DEFAULT_METRICS;
}

const isWeb = Platform.OS === "web";

/** Tinted lift shadow for the primary CTA. Web: layered box-shadow. Native: RN shadow + elevation. */
const primaryShadow = isWeb
  ? { boxShadow: "0px 1px 2px rgba(50, 50, 50, 0.08), 0px 4px 12px rgba(244, 83, 20, 0.28)" }
  : {
      shadowColor: "rgba(244, 83, 20, 0.35)" as const,
      shadowOffset: { width: 0, height: 4 } as const,
      shadowRadius: 10 as const,
      shadowOpacity: 1 as const,
      elevation: 4 as const,
    };

const primaryShadowHover = isWeb
  ? { boxShadow: "0px 2px 4px rgba(50, 50, 50, 0.1), 0px 8px 20px rgba(244, 83, 20, 0.32)" }
  : {};

const primaryShadowPress = isWeb
  ? { boxShadow: "0px 1px 2px rgba(50, 50, 50, 0.08), 0px 2px 6px rgba(244, 83, 20, 0.22)" }
  : {};

const noShadow = isWeb
  ? { boxShadow: "none" }
  : { shadowOpacity: 0 as const, elevation: 0 as const };

const focusRing = {
  outlineColor: "$primary",
  outlineStyle: "solid",
  outlineWidth: 2,
  outlineOffset: 2,
} as const;

/**
 * Styled context: the frame publishes `size` and `butterVariant` so the label
 * picks up matching type metrics and colour without prop drilling.
 */
export const ButtonContext = createStyledContext<{
  size: SizeTokens | number;
  butterVariant?: ButterVariant;
}>({
  size: DEFAULT_SIZE,
  butterVariant: undefined,
});

const ButtonFrame = styled(ThemeableStack, {
  name: "Button",
  tag: "button",
  role: "button",
  focusable: true,
  context: ButtonContext,

  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "nowrap",
  flexShrink: 0,
  cursor: "pointer",
  borderRadius: "$full",
  borderWidth: 0,
  backgroundColor: "transparent",

  variants: {
    size: {
      "...size": (value) => {
        const metrics = getButtonMetrics(value);
        return {
          height: metrics.height,
          minHeight: metrics.height,
          paddingHorizontal: metrics.paddingHorizontal,
        };
      },
      ":number": (value) => {
        const metrics = getButtonMetrics(value);
        return {
          height: metrics.height,
          minHeight: metrics.height,
          paddingHorizontal: metrics.paddingHorizontal,
        };
      },
    },

    butterVariant: {
      primary: {
        backgroundColor: "$primary",
        borderWidth: 0,
        ...primaryShadow,
        hoverStyle: {
          backgroundColor: "$primaryHover",
          y: -1,
          ...primaryShadowHover,
        },
        pressStyle: {
          backgroundColor: "$primaryPress",
          y: 0,
          scale: 0.98,
          ...primaryShadowPress,
        },
        focusVisibleStyle: focusRing,
      },

      secondary: {
        backgroundColor: "$buttonSecondaryBg",
        borderWidth: 1.5,
        borderColor: "$buttonSecondaryBorder",
        hoverStyle: {
          backgroundColor: "$buttonSecondaryBgHover",
          borderColor: "$buttonSecondaryBorderHover",
        },
        pressStyle: {
          backgroundColor: "$buttonSecondaryBgPress",
          borderColor: "$buttonSecondaryBorderHover",
          scale: 0.98,
        },
        focusVisibleStyle: focusRing,
      },

      ghost: {
        backgroundColor: "transparent",
        borderWidth: 0,
        hoverStyle: {
          backgroundColor: "$buttonGhostBgHover",
        },
        pressStyle: {
          backgroundColor: "$buttonGhostBgPress",
          scale: 0.98,
        },
        focusVisibleStyle: focusRing,
      },

      icon: {
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderColor: "$buttonSecondaryBorder",
        hoverStyle: {
          borderColor: "$primary",
          backgroundColor: "$primaryLight",
        },
        pressStyle: {
          borderColor: "$primary",
          backgroundColor: "$primaryLight",
          scale: 0.95,
        },
        focusVisibleStyle: focusRing,
      },
    },

    circular: {
      true: (_value, { props }) => {
        const { height } = getButtonMetrics((props as { size?: unknown }).size);
        return {
          borderRadius: 100000,
          padding: 0,
          paddingHorizontal: 0,
          width: height,
          height,
          minWidth: height,
          minHeight: height,
        };
      },
    },

    chromeless: {
      true: {
        backgroundColor: "transparent",
        borderColor: "transparent",
        ...noShadow,
      },
    },

    unstyled: {
      true: {
        backgroundColor: "transparent",
        borderWidth: 0,
        borderRadius: 0,
        padding: 0,
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        ...noShadow,
      },
    },

    disabled: {
      true: {
        pointerEvents: "none",
        opacity: 0.5,
      },
    },
  } as const,
});

export const ButtonText = styled(SizableText, {
  name: "ButtonText",
  context: ButtonContext,

  fontFamily: "$body",
  fontWeight: "600",
  letterSpacing: 0,
  textAlign: "center",
  userSelect: "none",
  cursor: "pointer",
  flexGrow: 0,
  flexShrink: 1,
  color: "$text",

  variants: {
    size: {
      "...size": (value) => {
        const metrics = getButtonMetrics(value);
        return { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight };
      },
      ":number": (value) => {
        const metrics = getButtonMetrics(value);
        return { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight };
      },
    },

    butterVariant: {
      primary: { color: "$white" },
      secondary: { color: "$buttonSecondaryText" },
      ghost: { color: "$text" },
      icon: { color: "$textSecondary" },
    },
  } as const,
});

/** Default label / icon colour per variant (also drives `currentColor` SVG icons). */
const VARIANT_COLOR: Record<ButterVariant, ColorTokens> = {
  primary: "$white",
  secondary: "$buttonSecondaryText",
  ghost: "$text",
  icon: "$textSecondary",
};

type TamaguiButtonExtras = Pick<
  TamaguiButtonProps,
  | "icon"
  | "iconAfter"
  | "scaleIcon"
  | "scaleSpace"
  | "space"
  | "spaceFlex"
  | "separator"
  | "noTextWrap"
  | "textProps"
  | "color"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "fontStyle"
  | "letterSpacing"
  | "textAlign"
  | "ellipse"
  | "maxFontSizeMultiplier"
>;

export interface ButtonExtraProps extends TamaguiButtonExtras {
  children?: ReactNode;
}

const webTransition = isWeb
  ? {
      transition:
        "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease, opacity 150ms ease",
    }
  : undefined;

const ButtonComponent = ButtonFrame.styleable<ButtonExtraProps>((propsIn, ref) => {
  const {
    butterVariant: variantProp,
    chromeless: chromelessProp,
    unstyled: unstyledProp,
    style,
    ...rest
  } = propsIn;

  // Variant prop types widen to token unions under the typed config; narrow them here.
  const chromeless = chromelessProp as boolean | "all" | undefined;
  const unstyled = unstyledProp as boolean | undefined;

  // `chromeless` / `unstyled` buttons opt out of the default primary look
  // unless a variant is requested explicitly.
  const butterVariant: ButterVariant | undefined =
    (variantProp as unknown as ButterVariant | undefined) ??
    (chromeless || unstyled ? undefined : "primary");

  const size = rest.size ?? DEFAULT_SIZE;
  const color = rest.color ?? (butterVariant ? VARIANT_COLOR[butterVariant] : undefined);

  const { props: buttonProps } = useButton(
    {
      ...rest,
      size,
      color,
      scaleIcon: rest.scaleIcon ?? 1.2,
      scaleSpace: rest.scaleSpace ?? 0.5,
      textProps: { size, ...rest.textProps },
    } as unknown as TamaguiButtonProps,
    { Text: ButtonText }
  );

  // useButton forces inline styles so text colour can flow through context.
  // We handle colour ourselves, so restore class-based styling.
  const {
    disableClassName: _disableClassName,
    size: sizeProp,
    ...frameProps
  } = buttonProps as Record<string, unknown>;
  void _disableClassName;

  return (
    <ButtonFrame
      ref={ref}
      butterVariant={butterVariant}
      {...(unstyled ? {} : { size: sizeProp as SizeTokens | number })}
      {...(frameProps as GetProps<typeof ButtonFrame>)}
      chromeless={chromeless}
      unstyled={unstyled}
      style={webTransition ? [webTransition, style] : style}
    />
  );
});

export const Button = withStaticProperties(ButtonComponent, {
  Text: ButtonText,
});

export type ButtonProps = GetProps<typeof ButtonComponent>;
