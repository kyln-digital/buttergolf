/**
 * Typography Components
 *
 * A comprehensive set of text components with semantic variants for different use cases.
 * Includes Text, Heading, and Label components.
 *
 * IMPORTANT: Understanding 'size' in the design system:
 *
 * 1. For TEXT COMPONENTS (Text, Heading, Paragraph, Label):
 *    - Use numeric tokens: size="$1" through size="$16" (standard Tamagui way)
 *    - These control fontSize and lineHeight from the font scale
 *    - Example: <Text size="$4">Body text</Text>
 *    - fontSize prop is for rare overrides only
 *
 * 2. For UI COMPONENTS:
 *    - Button: Use numeric tokens: size="$4", size="$5" (standard Tamagui SizeTokens)
 *    - Input, Badge, Spinner: Use named variants: size="sm" | "md" | "lg"
 *    - Example: <Button size="$5">Click me</Button>
 *
 * @example
 * ```tsx
 * // Text sizing - use size with numeric tokens (standard Tamagui)
 * <Text size="$4">Regular body text (14px)</Text>
 * <Text size="$5">Larger body text (15px)</Text>
 * <Text size="$3" color="$textMuted">Small text</Text>
 *
 * // Headings - use level prop (internally maps to size)
 * <Heading level={1}>Page Title</Heading>
 * <Heading level={2}>Section Title</Heading>
 *
 * // Component sizing
 * <Button size="$5">Medium button</Button>
 * <Input size="md">Medium input</Input>
 * ```
 */

import type { ReactNode, ForwardRefExoticComponent } from "react";
import {
  styled,
  GetProps,
  Paragraph as TamaguiParagraph,
  Label as TamaguiLabel,
  type ParagraphProps as TamaguiParagraphProps,
  type LabelProps as TamaguiLabelProps,
} from "tamagui";

/** Restores children: ReactNode on styled Tamagui text/layout components (v2 type regression fix). */
type WithReactChildren<C> =
  C extends ForwardRefExoticComponent<infer P>
    ? ForwardRefExoticComponent<Omit<P, "children"> & { children?: ReactNode }> &
        Omit<C, keyof ForwardRefExoticComponent<unknown>>
    : C;
function withReactChildren<C>(component: C): WithReactChildren<C> {
  return component as WithReactChildren<C>;
}

/**
 * Base Text Component
 *
 * Re-exports Tamagui's Text with default styling.
 * Uses Tamagui's built-in size system (numeric tokens $1-$16).
 * The size prop controls fontSize and lineHeight from tokens.size.
 *
 * We use Paragraph as the base which already has the fontSize variant system.
 *
 * IMPORTANT: Always use size="$n" tokens, NOT fontSize prop directly.
 * Using fontSize bypasses the size system and can cause lineHeight issues on React Native.
 */
export const Text = withReactChildren(
  styled(TamaguiParagraph, {
    name: "Text",
    color: "$text",
    fontFamily: "$body",
    letterSpacing: 0, // Prevent tight/condensed letter spacing
    // LineHeight is now handled by Tamagui's font token system (bodyFont.lineHeight)
    // The size prop (e.g., size="$5") automatically applies the correct lineHeight from tokens
    // This fixes text overlap issues caused by unitless multipliers overriding token values

    variants: {
      weight: {
        normal: {
          fontWeight: "400",
        },
        medium: {
          fontWeight: "500",
        },
        semibold: {
          fontWeight: "600",
        },
        bold: {
          fontWeight: "700",
        },
      },

      align: {
        left: {
          textAlign: "left",
        },
        center: {
          textAlign: "center",
        },
        right: {
          textAlign: "right",
        },
      },

      truncate: {
        true: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
    } as const,

    defaultVariants: {
      weight: "normal",
    },
  })
);

/**
 * Heading Components
 *
 * Semantic heading component that maps level to size tokens.
 * Uses Paragraph as base to get full Tamagui size prop support.
 *
 * The level prop controls the semantic HTML tag and the default size,
 * but you can override with an explicit size prop.
 */
export const Heading = withReactChildren(
  styled(TamaguiParagraph, {
    name: "Heading",
    color: "$text",
    fontFamily: "$heading",
    fontWeight: "700",
    letterSpacing: 0, // Prevent tight/condensed letter spacing
    // LineHeight is now handled by Tamagui's font token system (headingFont.lineHeight)
    // The level variant sets fontSize which automatically applies the correct lineHeight from tokens
    // This fixes text overlap issues caused by unitless multipliers overriding token values

    variants: {
      level: {
        1: {
          tag: "h1",
          fontSize: "$10", // 48px heading (use fontSize in variant, size on component)
        },
        2: {
          tag: "h2",
          fontSize: "$9", // 40px heading
        },
        3: {
          tag: "h3",
          fontSize: "$8", // 32px heading
        },
        4: {
          tag: "h4",
          fontSize: "$7", // 28px heading
        },
        5: {
          tag: "h5",
          fontSize: "$6", // 24px heading
        },
        6: {
          tag: "h6",
          fontSize: "$5", // 20px heading
        },
      },

      align: {
        left: {
          textAlign: "left",
        },
        center: {
          textAlign: "center",
        },
        right: {
          textAlign: "right",
        },
      },
    } as const,

    defaultVariants: {
      level: 2,
    },
  })
);

/**
 * Label Component for forms
 *
 * Uses Tamagui's standard size prop with numeric tokens.
 * Default: $3 (13px body font, 18px line-height)
 */
export const Label = withReactChildren(
  styled(TamaguiLabel, {
    name: "Label",

    color: "$text",
    size: "$3", // Default to small label size (13px)
    fontWeight: "500",
    marginBottom: "$2",
    cursor: "pointer",
    userSelect: "none",

    variants: {
      // Note: For required indicators, use a separate Text component for cross-platform compatibility
      // Example: <Row><Label>Name</Label><Text color="$error">*</Text></Row>

      disabled: {
        true: {
          opacity: 0.5,
          cursor: "not-allowed",
        },
      },
    } as const,
  })
);

// Export types that include BOTH our custom variants AND all base Tamagui props
// This ensures TypeScript knows about inherited props like color, textAlign, size, etc.
export type TextProps = GetProps<typeof Text> &
  Omit<TamaguiParagraphProps, keyof GetProps<typeof Text>>;
export type HeadingProps = GetProps<typeof Heading> &
  Omit<TamaguiParagraphProps, keyof GetProps<typeof Heading>>;
export type LabelProps = GetProps<typeof Label> &
  Omit<TamaguiLabelProps, keyof GetProps<typeof Label>>;
