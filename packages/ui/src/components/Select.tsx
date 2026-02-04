/**
 * Select Component
 *
 * A simple, cross-platform select/dropdown component with size variants and state styling.
 * Matches Input component styling for visual consistency in forms.
 *
 * Platform Behavior:
 * - Uses native HTML select element styled to match Input component
 * - Cross-platform compatible with consistent visual appearance
 *
 * IMPORTANT: Select 'size' is a COMPONENT VARIANT (not a font size token)
 * - size="sm" | "md" | "lg" controls the select's HEIGHT and PADDING
 * - Font size is set internally by each variant to match Input component
 *
 * @example
 * ```tsx
 * <Select
 *   size="md"
 *   value={category}
 *   onValueChange={setCategory}
 * >
 *   <option value="">Select category...</option>
 *   <option value="clubs">Golf Clubs</option>
 *   <option value="balls">Golf Balls</option>
 * </Select>
 *
 * <Select size="lg" error fullWidth>
 *   <option value="">Select...</option>
 *   <option value="new">New</option>
 *   <option value="used">Used</option>
 * </Select>
 * ```
 */

import { styled, GetProps } from "tamagui";
import { Select as TamaguiSelect, type SelectProps as TamaguiSelectProps } from "tamagui";

/**
 * Base Select component with Input-matching styles
 *
 * Uses the same design tokens as Input component:
 * - $fieldBorder for borders (Ironstone)
 * - $surface for background (Pure White)
 * - Size variants: sm/md/lg matching Input heights
 */
export const Select = styled(TamaguiSelect, {
  name: "Select",

  // Base styles matching Input component
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$fieldBorder",
  borderRadius: 24,
  outlineWidth: 0,

  // Focus styles (using border for better cross-platform support)
  focusStyle: {
    borderColor: "$fieldBorderFocus",
    borderWidth: 2,
  },

  // Hover styles
  hoverStyle: {
    borderColor: "$fieldBorderHover",
  },

  // Disabled styles
  disabledStyle: {
    opacity: 0.5,
    cursor: "not-allowed",
    backgroundColor: "$backgroundPress",
    borderColor: "$fieldBorderDisabled",
  },

  variants: {
    size: {
      sm: {
        height: "$inputSm",
        paddingHorizontal: "$2.5",
      },
      md: {
        height: "$inputMd",
        paddingHorizontal: "$3",
      },
      lg: {
        height: "$inputLg",
        paddingHorizontal: "$4",
      },
    },

    error: {
      true: {
        borderColor: "$error",

        focusStyle: {
          borderColor: "$error",
          borderWidth: 2,
        },

        hoverStyle: {
          borderColor: "$errorDark",
        },
      },
    },

    success: {
      true: {
        borderColor: "$success",

        focusStyle: {
          borderColor: "$success",
          borderWidth: 2,
        },
      },
    },

    fullWidth: {
      true: {
        width: "100%",
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

// Export type that includes BOTH our custom variants AND all base Tamagui Select props
export type SelectProps = GetProps<typeof Select> & TamaguiSelectProps;
