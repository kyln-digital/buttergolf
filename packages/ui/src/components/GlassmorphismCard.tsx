import { styled, View } from "tamagui";

/**
 * iOS-style liquid glass effect card
 *
 * Features:
 * - Backdrop blur (frosted glass effect)
 * - Semi-transparent gray background (#D9D9D9 at 30% opacity per Figma)
 * - 20px border radius (per Figma spec)
 * - Inner glow for dimensional "liquid" appearance
 * - Subtle border with transparency
 *
 * @example
 * ```tsx
 * <GlassmorphismCard intensity="medium" padding="$md">
 *   <Text>Content with glassmorphism effect</Text>
 * </GlassmorphismCard>
 * ```
 */
export const GlassmorphismCard = styled(View, {
  name: "GlassmorphismCard",

  // Default styling - Figma spec: #D9D9D9 at 30% opacity, 20px radius
  borderRadius: 20,
  borderWidth: 1.5,
  borderColor: "rgba(217, 217, 217, 0.4)",

  // Default intensity - Figma spec: #D9D9D9 at 30%
  backgroundColor: "rgba(217, 217, 217, 0.3)",

  variants: {
    intensity: {
      light: {
        // #D9D9D9 at 20% opacity
        backgroundColor: "rgba(217, 217, 217, 0.2)",
        borderColor: "rgba(217, 217, 217, 0.3)",
      },
      medium: {
        // #D9D9D9 at 30% opacity (Figma default)
        backgroundColor: "rgba(217, 217, 217, 0.3)",
        borderColor: "rgba(217, 217, 217, 0.4)",
      },
      strong: {
        // #D9D9D9 at 45% opacity
        backgroundColor: "rgba(217, 217, 217, 0.45)",
        borderColor: "rgba(217, 217, 217, 0.55)",
      },
      dark: {
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        borderColor: "rgba(217, 217, 217, 0.15)",
      },
    },
    blur: {
      none: {},
      light: {},
      medium: {},
      strong: {},
    },
  } as const,

  defaultVariants: {
    intensity: "medium",
    blur: "medium",
  } as const,
});

/**
 * Get consistent glassmorphism styles for web-specific styling
 * Use this when you need to apply the effect via style prop
 *
 * Creates a liquid glass effect with:
 * - Backdrop blur for frosted glass look
 * - Multiple layered shadows for depth and "liquid" edge appearance
 * - Inner highlight for dimensional glass effect
 */
export const getGlassmorphismStyles = (blur: "light" | "medium" | "strong" = "medium") => {
  const blurAmount = {
    light: "8px",
    medium: "16px",
    strong: "24px",
  }[blur];

  return {
    backdropFilter: `blur(${blurAmount}) saturate(180%)`,
    WebkitBackdropFilter: `blur(${blurAmount}) saturate(180%)`,
    // Liquid glass edge effect:
    // 1. Inner top highlight - creates glassy reflection
    // 2. Inner bottom shadow - adds depth
    // 3. Outer glow - soft edge diffusion for "liquid" feel
    // 4. Drop shadow - grounds the element
    boxShadow: `
      inset 0 1px 1px 0 rgba(255, 255, 255, 0.6),
      inset 0 -1px 1px 0 rgba(0, 0, 0, 0.05),
      0 0 0 1px rgba(255, 255, 255, 0.15),
      0 4px 16px -2px rgba(0, 0, 0, 0.1),
      0 8px 32px -4px rgba(0, 0, 0, 0.08)
    `
      .trim()
      .replaceAll(/\s+/g, " "),
  };
};

export type GlassmorphismCardProps = React.ComponentProps<typeof GlassmorphismCard>;
