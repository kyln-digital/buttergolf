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

import {
  styled,
  GetProps,
  Paragraph as TamaguiParagraph,
  Label as TamaguiLabel,
  type ParagraphProps as TamaguiParagraphProps,
  type LabelProps as TamaguiLabelProps,
} from "tamagui";

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
export const Text = styled(TamaguiParagraph, {
  name: "Text",
  color: "$text",
  fontFamily: "$body",
  letterSpacing: 0, // Prevent tight/condensed letter spacing
  // LineHeight is now handled by Tamagui's font token system (bodyFont.lineHeight)
  // The size prop (e.g., size="$5") automatically applies the correct lineHeight from tokens
  // This fixes text overlap issues caused by unitless multipliers overriding token values

  // No custom weight/align variants — use the native fontWeight/textAlign
  // props directly (the variants duplicated them and lost 3:1 in practice).
  fontWeight: "400",
});

/**
 * Heading Components
 *
 * Semantic heading component that maps level to size tokens.
 * Uses Paragraph as base to get full Tamagui size prop support.
 *
 * The level prop controls the semantic HTML tag and the default size,
 * but you can override with an explicit size prop.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HeadingFrame = styled(
  TamaguiParagraph,
  {
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
          fontSize: "$10", // 48px heading (use fontSize in variant, size on component)
        },
        2: {
          fontSize: "$9", // 40px heading
        },
        3: {
          fontSize: "$8", // 32px heading
        },
        4: {
          fontSize: "$7", // 28px heading
        },
        5: {
          fontSize: "$6", // 24px heading
        },
        6: {
          fontSize: "$5", // 20px heading
        },
      },
    } as const,

    defaultVariants: {
      level: 2,
    },
  },
  {
    // The optimizing compiler would otherwise flatten a static <Heading> into a
    // bare <p>, skipping the wrapper below that sets the semantic tag.
    neverFlatten: true,
  }
);

// `tag` set inside a variant is ignored by styled(), so the semantic element
// is applied here: level 1 renders <h1>, level 2 <h2>, and so on. An explicit
// `tag` prop still wins.
export const Heading = HeadingFrame.styleable((props, ref) => {
  const level = ((props as { level?: HeadingLevel }).level ?? 2) as HeadingLevel;
  return <HeadingFrame ref={ref} tag={`h${level}`} {...props} />;
});

/**
 * Label Component for forms
 *
 * Uses Tamagui's standard size prop with numeric tokens.
 * Default: $3 (13px body font, 18px line-height)
 */
export const Label = styled(TamaguiLabel, {
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
});

// Export types that include BOTH our custom variants AND all base Tamagui props
// This ensures TypeScript knows about inherited props like color, textAlign, size, etc.
export type TextProps = GetProps<typeof Text> &
  Omit<TamaguiParagraphProps, keyof GetProps<typeof Text>>;
export type HeadingProps = GetProps<typeof HeadingFrame> &
  Omit<TamaguiParagraphProps, keyof GetProps<typeof HeadingFrame>>;
export type LabelProps = GetProps<typeof Label> &
  Omit<TamaguiLabelProps, keyof GetProps<typeof Label>>;
