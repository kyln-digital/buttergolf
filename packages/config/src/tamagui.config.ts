import { defaultConfig } from "@tamagui/config/v4";
import { createTamagui, createTokens, createFont } from "tamagui";
// Platform-specific animations: bundlers resolve animations.ts (web) or animations.native.ts (mobile)
import { animations } from "./animations";

/**
 * ============================================================================
 * TAMAGUI SIZE SYSTEM DOCUMENTATION
 * ============================================================================
 *
 * This config extends @tamagui/config/v4 which provides NUMERIC SIZE TOKENS
 * for reliable, predictable sizing using standard Tamagui patterns.
 *
 * UNDERSTANDING SIZE IN TAMAGUI:
 *
 * 1. TYPOGRAPHY SIZE TOKENS (Numeric: $1 - $16) - THE STANDARD TAMAGUI WAY
 *    - Defined in: bodyFont.size and headingFont.size in this config
 *    - Used with: size="$n" prop on Text, Paragraph, Heading, Label
 *    - Example: <Text size="$4">Body text</Text>
 *    - Scale: $1=11px, $2=12px, $3=13px, $4=14px, $5=15px (body default)
 *    - The size prop automatically handles fontSize AND lineHeight from tokens
 *    - fontSize prop is for rare overrides only, not standard usage
 *
 * 2. COMPONENT SIZE VARIANTS (Named: sm | md | lg)
 *    - Defined in: Custom component variants (Button, Input, Badge, Spinner)
 *    - Used for: Geometric sizing (height, padding) of UI components
 *    - Example: <Button size="md">Click me</Button>
 *    - These are component-specific variants, NOT typography tokens
 *    - Internally, these variants use tokens.size for fontSize where appropriate
 *    - Button sm/md/lg maps to $buttonSm/$buttonMd/$buttonLg for height/padding
 *
 * 3. SPACING TOKENS (Named + Numeric)
 *    - Defined in: tokens.space
 *    - Used for: padding, margin, gap props
 *    - Example: padding="$md" or gap="$4"
 *    - Available: $xs, $sm, $md, $lg, $xl, $2xl, $3xl
 *    - Also: $1, $2, $3, etc. from defaultConfig
 *
 * WHY THIS APPROACH?
 * - Standard: Follows Tamagui's default patterns and documentation
 * - Predictable: Consistent behavior across platforms (web & mobile)
 * - Type-safe: Better TypeScript inference with standard Tamagui types
 * - Maintainable: Less custom code, easier upgrades
 *
 * USAGE GUIDE:
 * - ✅ CORRECT: <Text size="$4">Body text</Text>
 * - ✅ CORRECT: <Heading level={2}>Title</Heading>
 * - ✅ CORRECT: <Button size="md">Click me</Button>
 * - ❌ WRONG: <Text fontSize="$4">Text</Text> (use size instead)
 * - ❌ WRONG: <Text size="md">Text</Text> (no "md" token, use $4)
 * - ❌ WRONG: <Button fontSize="$4">Button</Button> (use size="md")
 *
 * ============================================================================
 */

// Urbanist font for Pure Butter brand identity
// Maps weight numbers to actual font family names (for React Native)
const urbanistFace = {
  normal: { normal: "Urbanist-Regular", italic: "Urbanist-Regular" },
  bold: { normal: "Urbanist-Bold", italic: "Urbanist-Bold" },
  100: { normal: "Urbanist-Regular", italic: "Urbanist-Regular" },
  200: { normal: "Urbanist-Regular", italic: "Urbanist-Regular" },
  300: { normal: "Urbanist-Regular", italic: "Urbanist-Regular" },
  400: { normal: "Urbanist-Regular", italic: "Urbanist-Regular" },
  500: { normal: "Urbanist-Medium", italic: "Urbanist-Medium" },
  600: { normal: "Urbanist-SemiBold", italic: "Urbanist-SemiBold" },
  700: { normal: "Urbanist-Bold", italic: "Urbanist-Bold" },
  800: { normal: "Urbanist-ExtraBold", italic: "Urbanist-ExtraBold" },
  900: { normal: "Urbanist-Black", italic: "Urbanist-Black" },
};

const headingFont = createFont({
  family: "Urbanist, -apple-system, system-ui, BlinkMacSystemFont, sans-serif",
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 40,
    10: 48,
    11: 56,
    12: 64,
    13: 72,
    14: 80,
    15: 96,
    16: 112,
  },
  // LineHeight defined as explicit pixel values for predictable spacing
  lineHeight: {
    1: 16,
    2: 18,
    3: 20,
    4: 22,
    5: 24,
    6: 28,
    7: 32,
    8: 38,
    9: 46,
    10: 54,
    11: 62,
    12: 70,
    13: 78,
    14: 86,
    15: 104,
    16: 120,
  },
  weight: {
    1: "100",
    2: "200",
    3: "300",
    4: "400",
    5: "500",
    6: "600",
    7: "700",
    8: "800",
    9: "900",
  },
  // letterSpacing removed - we don't want tight/condensed spacing
  face: urbanistFace,
});

const bodyFont = createFont({
  family: "Urbanist, -apple-system, system-ui, BlinkMacSystemFont, sans-serif",
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    5: 15,
    6: 16,
    7: 18,
    8: 20,
    9: 22,
    10: 24,
    11: 28,
    12: 32,
    13: 40,
    14: 48,
    15: 56,
    16: 64,
  },
  // LineHeight defined as explicit pixel values for predictable spacing
  lineHeight: {
    1: 15,
    2: 16,
    3: 18,
    4: 20,
    5: 22,
    6: 24,
    7: 26,
    8: 28,
    9: 30,
    10: 32,
    11: 36,
    12: 40,
    13: 48,
    14: 56,
    15: 64,
    16: 72,
  },
  weight: {
    1: "100",
    2: "200",
    3: "300",
    4: "400", // Book weight for body text
    5: "500",
    6: "600",
    7: "700",
    8: "800",
    9: "900",
  },
  // letterSpacing removed - we don't want tight/condensed spacing
  face: urbanistFace,
});

// Brand Colors - 10-shade scales for all color families
// Brand colors from Figma - Pure Butter Golf Theme (sRGB)
const brandColors = {
  // Primary - Spiced Clementine (vibrant orange)
  spicedClementine: "#F45314",
  spicedClementineHover: "#D9450F", // 12% darker for hover
  spicedClementinePress: "#BF3A0D", // 22% darker for press

  // Primary Light - Vanilla Cream (light background)
  vanillaCream: "#FFFAD2",
  vanillaCreamHover: "#FFF8C5", // Slightly darker
  vanillaCreamPress: "#FFF6B8", // More contrast

  // Secondary - Lemon Haze (subtle accent)
  lemonHaze: "#EDECC3",
  lemonHazeHover: "#E5E4B5",
  lemonHazePress: "#DDDBA7",

  // Tertiary - Burnt Olive (dark accent)
  burntOlive: "#3E3B2C",
  burntOliveHover: "#33302A", // Darker for hover
  burntOlivePress: "#272521", // Even darker for press

  // Neutral Light - Cloud Mist (borders/dividers)
  cloudMist: "#EDEDED",
  cloudMistHover: "#E0E0E0",
  cloudMistPress: "#D4D4D4",

  // Neutral Mid - Slate Smoke (secondary text)
  slateSmoke: "#545454",
  slateSmokeHover: "#3E3E3E",
  slateSmokePress: "#2A2A2A",

  // Neutral Dark - Ironstone (primary text)
  ironstone: "#323232",
  ironstoneHover: "#2A2A2A",
  ironstonePress: "#1F1F1F",

  // Base - Pure White
  pureWhite: "#FFFFFF",

  // Extended gray scale (for app compatibility)
  gray100: "#F5F5F5", // Very light gray
  gray200: "#E5E5E5", // Light gray
  gray700: "#707070", // Medium gray (for neutral badge text)
  gray900: "#1A1A1A", // Very dark gray

  // Opacity Overlays - for elements on colored backgrounds
  // Light overlays (for dark backgrounds like Burnt Olive)
  overlayLight10: "rgba(255, 255, 255, 0.1)",
  overlayLight20: "rgba(255, 255, 255, 0.2)",
  overlayLight30: "rgba(255, 255, 255, 0.3)",
  overlayLight40: "rgba(255, 255, 255, 0.4)",
  overlayLight60: "rgba(255, 255, 255, 0.6)",

  // Dark overlays (for light backgrounds like Vanilla Cream)
  overlayDark5: "rgba(0, 0, 0, 0.05)",
  overlayDark10: "rgba(0, 0, 0, 0.1)",
  overlayDark20: "rgba(0, 0, 0, 0.2)",
  overlayDark30: "rgba(0, 0, 0, 0.3)",
  overlayDark50: "rgba(0, 0, 0, 0.5)",

  // Success state (keeping existing teal palette - complements theme)
  successBase: "#02aaa4",
  successLight: "#e6fffc",
  successDark: "#017d7a",
  successHover: "#029490",
  successPress: "#016765",

  // Error state (keeping existing red palette - universal standard)
  errorBase: "#dc2626",
  errorLight: "#fee2e2",
  errorDark: "#b91c1c",
  errorHover: "#ef4444",
  errorPress: "#991b1b",

  // Warning state (using Spiced Clementine as it fits the energetic warning tone)
  warningBase: "#F45314",
  warningLight: "#FFF4ED",
  warningDark: "#BF3A0D",

  // Info state (using muted blue that complements the palette)
  infoBase: "#3c50e0",
  infoLight: "#eff6ff",
  infoDark: "#1d4ed8",

  // Button-specific borders (for depth on filled buttons)
  primaryBorder: "#F04300", // Darker than spicedClementine
  secondaryBorder: "#000000", // Pure black for Ironstone buttons
};

// Create custom tokens with complete design system
const customTokens = createTokens({
  color: {
    ...brandColors,

    // Primary brand color (Spiced Clementine)
    primary: brandColors.spicedClementine,
    primaryLight: brandColors.vanillaCream,
    primaryHover: brandColors.spicedClementineHover,
    primaryPress: brandColors.spicedClementinePress,
    primaryFocus: brandColors.spicedClementine,

    // Secondary brand color (Burnt Olive)
    secondary: brandColors.burntOlive,
    secondaryLight: brandColors.lemonHaze,
    secondaryHover: brandColors.burntOliveHover,
    secondaryPress: brandColors.burntOlivePress,
    secondaryFocus: brandColors.burntOlive,

    // Semantic state colors
    success: brandColors.successBase,
    successLight: brandColors.successLight,
    successDark: brandColors.successDark,

    error: brandColors.errorBase,
    errorLight: brandColors.errorLight,
    errorDark: brandColors.errorDark,

    warning: brandColors.warningBase,
    warningLight: brandColors.warningLight,
    warningDark: brandColors.warningDark,

    info: brandColors.infoBase,
    infoLight: brandColors.infoLight,
    infoDark: brandColors.infoDark,

    // Background colors (Pure White base with Cloud Mist hover)
    background: brandColors.pureWhite,
    backgroundHover: brandColors.cloudMist,
    backgroundPress: brandColors.cloudMistPress,
    backgroundFocus: brandColors.lemonHaze,
    backgroundStrong: brandColors.lemonHaze,
    backgroundTransparent: "rgba(255, 255, 255, 0)",

    // Text colors (Ironstone primary, Slate Smoke secondary)
    text: brandColors.ironstone,
    textSecondary: brandColors.slateSmoke,
    textTertiary: brandColors.cloudMist,
    textMuted: brandColors.cloudMist,
    textInverse: brandColors.pureWhite,
    helperText: brandColors.ironstone,

    // Outline color for focus states (used by Tamagui form components)
    outlineColor: brandColors.spicedClementine,

    // Surface colors (Pure White cards on Vanilla Cream background)
    surface: brandColors.pureWhite,
    card: brandColors.pureWhite,
    cardHover: brandColors.cloudMist,

    // Border colors - Structural (Cloud Mist neutrals for cards, dividers, sheets)
    border: brandColors.cloudMist,
    borderHover: brandColors.cloudMistHover,
    borderFocus: brandColors.spicedClementine,
    borderPress: brandColors.spicedClementinePress,

    // Alias for Tamagui's expected token names (some components use borderColor* prefix)
    borderColor: brandColors.cloudMist,
    borderColorHover: brandColors.cloudMistHover,
    borderColorFocus: brandColors.spicedClementine,
    borderColorPress: brandColors.spicedClementinePress,

    // Field border colors - Form inputs (Ironstone for inputs, selects, textareas)
    fieldBorder: brandColors.ironstone,
    fieldBorderHover: brandColors.ironstoneHover,
    fieldBorderFocus: brandColors.spicedClementine,
    fieldBorderPress: brandColors.ironstonePress,
    fieldBorderDisabled: brandColors.cloudMist,

    // Shadow colors (soft, subtle shadows for vintage feel)
    shadowColor: brandColors.overlayDark10,
    shadowColorHover: brandColors.overlayDark20,
    shadowColorPress: brandColors.overlayDark30,
    shadowColorFocus: "rgba(244, 83, 20, 0.25)", // Spiced Clementine tint

    // Inverse overlays for elements on dark backgrounds (headers, modals)
    inverseSurface: brandColors.overlayLight20,
    inverseSurfaceHover: brandColors.overlayLight30,
    inverseSurfacePress: brandColors.overlayLight40,
    inverseBorder: brandColors.overlayLight40,
    inverseBorderHover: brandColors.overlayLight60,
    inverseBorderPress: brandColors.overlayLight60,

    // Generic color states (Ironstone-based)
    color: brandColors.ironstone,
    colorHover: brandColors.ironstoneHover,
    colorPress: brandColors.ironstonePress,
    colorFocus: brandColors.ironstone,
    colorTransparent: "rgba(50, 50, 50, 0)",

    // Button-specific borders
    primaryBorder: brandColors.primaryBorder,
    secondaryBorder: brandColors.secondaryBorder,

    // White token (referenced by themes)
    white: brandColors.pureWhite,

    // Backward compatibility aliases removed — use semantic tokens (e.g. "$background", "$textMuted")
  },

  size: {
    ...defaultConfig.tokens.size,
    // Component sizes (button, input, icon heights)
    buttonSm: 32,
    buttonMd: 40,
    buttonLg: 48,
    inputSm: 32,
    inputMd: 40,
    inputLg: 48,
    iconSm: 16,
    iconMd: 20,
    iconLg: 24,
    iconXl: 32,
  },

  space: {
    ...defaultConfig.tokens.space,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
  },

  radius: {
    ...defaultConfig.tokens.radius,
    xs: 3,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    "2xl": 26,
    full: 9999,
  },

  zIndex: {
    ...defaultConfig.tokens.zIndex,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
});

// Animations are imported from ./animations (platform-specific)
// - Web (Next.js): uses animations.ts with @tamagui/animations-css
// - Mobile (Expo): uses animations.native.ts with @tamagui/animations-react-native

// Light theme with semantic token mappings (Pure White background)
const lightTheme = {
  // Background colors (Pure White base)
  background: brandColors.pureWhite,
  backgroundHover: brandColors.cloudMist,
  backgroundPress: brandColors.cloudMistPress,
  backgroundFocus: brandColors.lemonHaze,
  backgroundStrong: brandColors.lemonHaze,
  backgroundTransparent: "rgba(255, 255, 255, 0)",

  // Text colors (Ironstone on white)
  color: brandColors.ironstone,
  colorHover: brandColors.ironstoneHover,
  colorPress: brandColors.ironstonePress,
  colorFocus: brandColors.ironstone,
  colorTransparent: "rgba(50, 50, 50, 0)",

  // Primary brand color (Spiced Clementine)
  primary: brandColors.spicedClementine,
  primaryHover: brandColors.spicedClementineHover,
  primaryPress: brandColors.spicedClementinePress,
  primaryFocus: brandColors.spicedClementine,
  primaryLight: brandColors.vanillaCream,
  // Subtle primary for hover backgrounds (10% opacity)
  primarySubtle: "rgba(244, 83, 20, 0.1)",

  // Secondary brand color (Burnt Olive)
  secondary: brandColors.burntOlive,
  secondaryHover: brandColors.burntOliveHover,
  secondaryPress: brandColors.burntOlivePress,
  secondaryFocus: brandColors.burntOlive,
  secondaryLight: brandColors.lemonHaze,

  // Success state colors
  success: brandColors.successBase,
  successLight: brandColors.successLight,
  successDark: brandColors.successDark,

  // Error state colors
  error: brandColors.errorBase,
  errorLight: brandColors.errorLight,
  errorDark: brandColors.errorDark,

  // Warning state colors
  warning: brandColors.warningBase,
  warningLight: brandColors.warningLight,
  warningDark: brandColors.warningDark,

  // Info state colors
  info: brandColors.infoBase,
  infoLight: brandColors.infoLight,
  infoDark: brandColors.infoDark,

  // Text semantic colors
  text: brandColors.ironstone,
  textSecondary: brandColors.slateSmoke,
  textTertiary: brandColors.cloudMist,
  textMuted: brandColors.cloudMist,
  textInverse: brandColors.pureWhite,

  // Surface colors (Pure White cards)
  surface: brandColors.pureWhite,
  card: brandColors.pureWhite,
  cardHover: brandColors.cloudMist,

  // Border colors (Cloud Mist neutrals)
  border: brandColors.cloudMist,
  borderHover: brandColors.cloudMistHover,
  borderFocus: brandColors.spicedClementine,
  borderPress: brandColors.spicedClementinePress,

  // Shadow colors
  shadowColor: brandColors.overlayDark10,
  shadowColorHover: brandColors.overlayDark20,
  shadowColorPress: brandColors.overlayDark30,
  shadowColorFocus: "rgba(244, 83, 20, 0.2)", // Spiced Clementine tint

  // Inverse surface (for dark elements on light bg)
  inverseSurface: brandColors.ironstone,
  inverseSurfaceHover: brandColors.ironstoneHover,
  inverseSurfacePress: brandColors.ironstonePress,
  inverseBorder: brandColors.ironstone,
  inverseBorderHover: brandColors.ironstoneHover,
  inverseBorderPress: brandColors.ironstonePress,

  // Utility colors
  white: brandColors.pureWhite,
  cream: brandColors.vanillaCream,
};

// Dark theme with semantic token mappings (Burnt Olive becomes dominant)
const darkTheme = {
  // Background colors - override tokens for dark mode (Burnt Olive)
  background: brandColors.burntOlive,
  backgroundHover: brandColors.burntOliveHover,
  backgroundPress: brandColors.burntOlivePress,
  backgroundFocus: brandColors.burntOliveHover,
  backgroundStrong: brandColors.ironstone,
  backgroundTransparent: "rgba(62, 59, 44, 0)",

  // Text colors - override for dark mode (Pure White on dark)
  color: brandColors.pureWhite,
  colorHover: brandColors.cloudMist,
  colorPress: brandColors.lemonHaze,
  colorFocus: brandColors.pureWhite,
  colorTransparent: "rgba(255, 255, 255, 0)",

  // Semantic colors (adjusted for dark mode - brighter for contrast)
  primary: brandColors.spicedClementine,
  primaryHover: brandColors.spicedClementineHover,
  primaryPress: brandColors.spicedClementinePress,
  primaryFocus: brandColors.spicedClementine,
  primaryLight: brandColors.ironstone,
  // Subtle primary for hover backgrounds (15% on dark for visibility)
  primarySubtle: "rgba(244, 83, 20, 0.15)",

  secondary: brandColors.lemonHaze,
  secondaryHover: brandColors.lemonHazeHover,
  secondaryPress: brandColors.lemonHazePress,
  secondaryFocus: brandColors.lemonHaze,
  secondaryLight: brandColors.ironstone,
  // Softer border for cream buttons on dark background (Burnt Olive instead of pure black)
  secondaryBorder: brandColors.burntOlive,

  success: brandColors.successBase,
  successLight: brandColors.ironstone,
  successDark: brandColors.successHover,

  error: brandColors.errorBase,
  errorLight: brandColors.ironstone,
  errorDark: brandColors.errorHover,

  warning: brandColors.warningBase,
  warningLight: brandColors.ironstone,
  warningDark: brandColors.spicedClementineHover,

  info: brandColors.infoBase,
  infoLight: brandColors.ironstone,
  infoDark: brandColors.infoLight,

  // Text semantic colors - override for dark mode
  text: brandColors.pureWhite,
  textSecondary: brandColors.cloudMist,
  textTertiary: brandColors.slateSmoke,
  textMuted: brandColors.slateSmokeHover,
  textInverse: brandColors.ironstone,

  // Surface colors - override for dark mode (Ironstone surfaces)
  surface: brandColors.ironstone,
  card: brandColors.ironstone,
  cardHover: brandColors.ironstoneHover,

  // Border colors - override for dark mode
  border: brandColors.slateSmoke,
  borderHover: brandColors.cloudMist,
  borderFocus: brandColors.spicedClementine,
  borderPress: brandColors.spicedClementinePress,

  // Shadow colors - override for dark mode
  shadowColor: brandColors.overlayDark20,
  shadowColorHover: brandColors.overlayDark30,
  shadowColorPress: brandColors.overlayDark50,
  shadowColorFocus: "rgba(244, 83, 20, 0.3)", // Spiced Clementine tint

  inverseSurface: brandColors.overlayLight20,
  inverseSurfaceHover: brandColors.overlayLight30,
  inverseSurfacePress: brandColors.overlayLight40,
  inverseBorder: brandColors.overlayLight30,
  inverseBorderHover: brandColors.overlayLight40,
  inverseBorderPress: brandColors.overlayLight60,

  // Utility colors
  white: brandColors.pureWhite,
  cream: brandColors.vanillaCream,
};

// Sub-theme for active states (light mode)
// When using <Theme name="active">, it will use light_active in light mode
const light_active = {
  ...lightTheme,
  // Override specific colors for active state (Spiced Clementine)
  color: brandColors.spicedClementine,
  colorHover: brandColors.spicedClementineHover,
  colorPress: brandColors.spicedClementinePress,
  colorFocus: brandColors.spicedClementine,

  // Keep background subtle (Lemon Haze highlight)
  background: brandColors.lemonHaze,
  backgroundHover: brandColors.lemonHazeHover,
  backgroundPress: brandColors.lemonHazePress,
};

// Sub-theme for active states (dark mode)
// When using <Theme name="active">, it will use dark_active in dark mode
const dark_active = {
  ...darkTheme,
  // Override specific colors for active state (Spiced Clementine)
  colorHover: brandColors.spicedClementineHover,
  colorPress: brandColors.spicedClementinePress,
  colorFocus: brandColors.spicedClementine,

  // Keep background subtle (use Burnt Olive for dark backgrounds)
  background: brandColors.burntOlive,
  backgroundHover: brandColors.burntOliveHover,
  backgroundPress: brandColors.burntOlivePress,
};

// Sub-theme for error states (light mode)
const light_error = {
  ...lightTheme,
  color: brandColors.errorBase,
  colorHover: brandColors.errorDark,
  colorPress: brandColors.errorPress,
  background: brandColors.errorLight,
  backgroundHover: brandColors.errorLight,
  border: brandColors.errorHover,
};

// Sub-theme for error states (dark mode)
const dark_error = {
  ...darkTheme,
  color: brandColors.errorBase,
  colorHover: brandColors.errorHover,
  colorPress: brandColors.errorDark,
  background: brandColors.ironstone,
  backgroundHover: brandColors.ironstoneHover,
  border: brandColors.errorBase,
};

// Sub-theme for success states (light mode)
const light_success = {
  ...lightTheme,
  color: brandColors.successBase,
  colorHover: brandColors.successDark,
  colorPress: brandColors.successPress,
  background: brandColors.successLight,
  backgroundHover: brandColors.successLight,
  border: brandColors.successHover,
};

// Sub-theme for success states (dark mode)
const dark_success = {
  ...darkTheme,
  color: brandColors.successBase,
  colorHover: brandColors.successHover,
  colorPress: brandColors.successDark,
  background: brandColors.ironstone,
  backgroundHover: brandColors.ironstoneHover,
  border: brandColors.successBase,
};

// Sub-theme for warning states (light mode)
const light_warning = {
  ...lightTheme,
  color: brandColors.warningDark,
  colorHover: brandColors.spicedClementinePress,
  colorPress: brandColors.ironstone,
  background: brandColors.warningLight,
  backgroundHover: brandColors.warningLight,
  border: brandColors.warningBase,
};

// Sub-theme for warning states (dark mode)
const dark_warning = {
  ...darkTheme,
  color: brandColors.warningBase,
  colorHover: brandColors.spicedClementineHover,
  colorPress: brandColors.warningDark,
  background: brandColors.ironstone,
  backgroundHover: brandColors.ironstoneHover,
  border: brandColors.warningBase,
};

export const config = createTamagui({
  ...defaultConfig,
  tokens: customTokens,
  themes: {
    // Base themes
    light: lightTheme,
    dark: darkTheme,

    // Active state sub-themes
    light_active,
    dark_active,

    // Error state sub-themes
    light_error,
    dark_error,

    // Success state sub-themes
    light_success,
    dark_success,

    // Warning state sub-themes
    light_warning,
    dark_warning,
  },
  // Urbanist fonts for Pure Butter brand
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  // Animations for Sheet and other animated components
  animations,
  // Media queries for responsive design
  media: {
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
    xl: { maxWidth: 1420 },
    xxl: { maxWidth: 1600 },
    gtXs: { minWidth: 660 + 1 },
    gtSm: { minWidth: 800 + 1 },
    gtMd: { minWidth: 1020 + 1 },
    gtLg: { minWidth: 1280 + 1 },
    gtXl: { minWidth: 1420 + 1 },
    gtXxl: { minWidth: 1600 + 1 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hoverNone: { hover: "none" },
    pointerCoarse: { pointer: "coarse" },
  },
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
});

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
