// Brand colours - base/hover/press shades per family (status colours add Light/Dark)
// Brand colours from Figma - Pure Butter Golf Theme (sRGB)
// Single source of truth: these feed the Tamagui tokens/themes below and are
// exported for the rare contexts that need raw colour values (React Navigation
// themes, Stripe appearance objects, WebView inline styles); includes hex and rgba strings.
export const brandColors = {
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
  gray600: "#666666", // Card background in dark mode (lighter than surface for elevation)
  gray700: "#707070", // Medium gray (for neutral badge text)
  gray900: "#1A1A1A", // Very dark gray

  // Opacity Overlays - for elements on colored backgrounds
  // Light overlays (for dark backgrounds like Burnt Olive)
  overlayLight10: "rgba(255, 255, 255, 0.1)",
  overlayLight20: "rgba(255, 255, 255, 0.2)",
  overlayLight30: "rgba(255, 255, 255, 0.3)",
  overlayLight40: "rgba(255, 255, 255, 0.4)",
  overlayLight60: "rgba(255, 255, 255, 0.6)",
  overlayLight70: "rgba(255, 255, 255, 0.7)",

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

  // Third-party logo colours, fixed by Google's sign-in branding guidelines
  // (the four segments of the "G" on "Continue with Google")
  googleBlue: "#4285F4",
  googleRed: "#EA4335",
  googleYellow: "#FBBC05",
  googleGreen: "#34A853",
} as const;

export type BrandColor = keyof typeof brandColors;
