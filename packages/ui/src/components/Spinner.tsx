/**
 * Spinner Component
 *
 * A loading indicator with multiple sizes and colors.
 * Re-exports Tamagui's Spinner with semantic variants.
 *
 * IMPORTANT: Spinner 'size' is a COMPONENT VARIANT (not a font size token)
 * - size="sm" | "md" | "lg" controls the spinner's WIDTH and HEIGHT
 * - Uses space tokens ($4, $5, $6) for geometric dimensions
 *
 * Accepts BOTH the named variants (sm | md | lg) and the documented numeric
 * size tokens ($3-$6) so it is consistent with Button. Existing named usages
 * keep working.
 *
 * @example
 * ```tsx
 * <Spinner size="md" />
 * <Spinner size="lg" color="$primary" />
 * <Spinner size="$5" color="$success" />
 * ```
 */

import {
  styled,
  GetProps,
  Spinner as TamaguiSpinner,
  type SpinnerProps as TamaguiSpinnerProps,
} from "tamagui";

export const Spinner = styled(TamaguiSpinner, {
  name: "Spinner",

  color: "$primary",

  variants: {
    size: {
      // Named variants (legacy / documented in CLAUDE.md)
      sm: {
        width: "$4",
        height: "$4",
      },
      md: {
        width: "$5",
        height: "$5",
      },
      lg: {
        width: "$6",
        height: "$6",
      },
      // Numeric tokens for parity with Button (size="$4" etc.)
      "$3": {
        width: "$3",
        height: "$3",
      },
      "$4": {
        width: "$4",
        height: "$4",
      },
      "$5": {
        width: "$5",
        height: "$5",
      },
      "$6": {
        width: "$6",
        height: "$6",
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

// Export type that includes BOTH our custom variants AND all base Tamagui Spinner props
export type SpinnerProps = GetProps<typeof Spinner> &
  Omit<TamaguiSpinnerProps, keyof GetProps<typeof Spinner>>;
