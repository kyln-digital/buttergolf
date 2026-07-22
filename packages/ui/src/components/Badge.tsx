/**
 * Badge Component
 *
 * A small label component for status indicators, counts, and tags.
 * Supports multiple variants and sizes.
 *
 * IMPORTANT: Badge 'size' is a COMPONENT VARIANT (not a font size token)
 * - size="sm" | "md" | "lg" controls the badge's HEIGHT and PADDING
 * - For text within badges, use <Text fontSize="$x"> with numeric tokens
 *
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="error" size="sm">3</Badge>
 * <Badge variant="info">New</Badge>
 * ```
 */

import { styled, GetProps, View, type ViewProps } from "tamagui";

export const Badge = styled(View, {
  name: "Badge",

  // Base styles
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  borderRadius: "$full",

  variants: {
    variant: {
      primary: {
        backgroundColor: "$primary",
      },

      secondary: {
        backgroundColor: "$secondary",
      },

      success: {
        backgroundColor: "$successLight",
      },

      error: {
        backgroundColor: "$errorLight",
      },

      warning: {
        backgroundColor: "$warningLight",
      },

      info: {
        backgroundColor: "$infoLight",
      },

      neutral: {
        backgroundColor: "$backgroundPress",
      },

      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "$border",
      },
    },

    size: {
      // Named variants (legacy / documented in CLAUDE.md)
      sm: {
        paddingHorizontal: "$2",
        paddingVertical: "$1",
        minHeight: 20,
        minWidth: 20,
      },
      md: {
        paddingHorizontal: "$2.5",
        paddingVertical: "$1.5",
        minHeight: 24,
        minWidth: 24,
      },
      lg: {
        paddingHorizontal: "$3",
        paddingVertical: "$2",
        minHeight: 28,
        minWidth: 28,
      },
      // Numeric tokens for parity with Button (size="$3" etc.).
      // Mapped onto the equivalent named sizes.
      $2: {
        paddingHorizontal: "$2",
        paddingVertical: "$1",
        minHeight: 20,
        minWidth: 20,
      },
      $3: {
        paddingHorizontal: "$2.5",
        paddingVertical: "$1.5",
        minHeight: 24,
        minWidth: 24,
      },
      $4: {
        paddingHorizontal: "$3",
        paddingVertical: "$2",
        minHeight: 28,
        minWidth: 28,
      },
    },

    dot: {
      true: {
        width: 8,
        height: 8,
        borderRadius: "$full",
        padding: 0,
        minWidth: 8,
        minHeight: 8,
      },
    },
  } as const,
});

// Export type that includes BOTH our custom variants AND all base View props
// Note: Badge uses 'color' in variants but View doesn't have native color prop - variants override
export type BadgeProps = GetProps<typeof Badge> & Omit<ViewProps, keyof GetProps<typeof Badge>>;
