/**
 * Brand Colors - Single source of truth
 *
 * These hex values define ButterGolf's brand identity.
 * Used by:
 * - Tamagui config (packages/config/src/tamagui.config.ts)
 * - React Navigation themes (apps/mobile/App.tsx)
 * - Any other context requiring raw hex values
 *
 * @see packages/config for semantic token mappings ($primary, $text, etc.)
 */
export const brandColors = {
  // Primary - Spiced Clementine (vibrant orange)
  spicedClementine: "#F45314",
  spicedClementineHover: "#E04A10",
  spicedClementinePress: "#CC420E",

  // Primary Light - Vanilla Cream (light background)
  vanillaCream: "#FFFAD2",

  // Secondary - Burnt Olive (dark accent)
  burntOlive: "#3E3B2C",
  burntOliveLight: "#4A473A", // Slightly lighter for cards in dark mode

  // Tertiary - Lemon Haze (subtle accent)
  lemonHaze: "#EDECC3",

  // Neutrals
  pureWhite: "#FFFFFF",
  ironstone: "#323232", // Primary text
  slateSmoke: "#545454", // Secondary text
  cloudMist: "#EDEDED", // Borders/dividers

  // Dark mode specific
  darkBorder: "#5A5749", // Lighter border for dark mode
} as const;

export type BrandColor = keyof typeof brandColors;
