# @buttergolf/config

> Tamagui configuration and design tokens for ButterGolf

This package provides the centralized Tamagui configuration, including design tokens, themes, and media queries for the ButterGolf design system.

## 📦 Package Contents

- **Design Tokens**: Colors, spacing, sizing, radii, and z-index values
- **Themes**: Light and dark theme configurations
- **Media Queries**: Responsive breakpoints
- **Brand Colors**: ButterGolf color palette with semantic mappings

## 🎨 Token System

### Color Tokens

#### Brand Colors

```tsx
// Primary Brand (Greens)
$green50 to $green900    // 10 shades
$primary                 // Alias for $green500
$primaryHover            // Hover state
$primaryPress            // Press state

// Secondary Brand (Amber/Gold)
$amber50 to $amber900    // 10 shades
$secondary               // Alias for $amber400
$secondaryHover
$secondaryPress

// Neutrals (Grays)
$gray50 to $gray900      // 10 shades
$text                    // Primary text color
$textSecondary
$textMuted
```

#### Semantic Colors

```tsx
// Status Colors
$success, $successLight, $successDark    // Teal tones
$error, $errorLight, $errorDark          // Red tones
$warning, $warningLight, $warningDark    // Amber tones
$info, $infoLight, $infoDark             // Blue tones

// Interactive Colors
$blue50 to $blue900      // Info/link colors
$teal50 to $teal900      // Success colors
$red50 to $red900        // Error colors
```

#### Background Colors

```tsx
$background; // Main app background
$backgroundHover; // Hover state
$backgroundPress; // Press state
$surface; // Surface/card background
$card; // Card background

// Backward compatibility
($bg, $bgGray, $bgCard, $text, $textDark, $muted);
```

### Spacing Tokens

```tsx
$xs: 4px
$sm: 8px
$md: 16px
$lg: 24px
$xl: 32px
$2xl: 48px
$3xl: 64px
```

### Size Tokens

```tsx
// Component Sizes
$buttonSm: 32px
$buttonMd: 40px
$buttonLg: 48px
$inputSm: 32px
$inputMd: 40px
$inputLg: 48px

// Icon Sizes
$iconSm: 16px
$iconMd: 20px
$iconLg: 24px
$iconXl: 32px
```

### Radius Tokens

```tsx
$xs: 2px
$sm: 4px
$md: 8px
$lg: 12px
$xl: 16px
$2xl: 24px
$full: 9999px    // Perfect circle
```

### Z-Index Tokens

```tsx
$dropdown: 1000;
$sticky: 1020;
$fixed: 1030;
$modalBackdrop: 1040;
$modal: 1050;
$popover: 1060;
$tooltip: 1070;
```

## 🌓 Themes

### Light Theme

```tsx
{
  background: offWhite (#fbfbf9)
  color: gray900 (#111827)
  primary: green500 (#13a063)
  secondary: amber400 (#f2b705)
  borderColor: gray200
  // ... and more
}
```

### Dark Theme

```tsx
{
  background: gray900 (#111827)
  color: gray50 (#f9fafb)
  primary: green400 (lighter for dark bg)
  secondary: amber400
  borderColor: gray700
  // ... and more
}
```

## 📱 Media Queries

```tsx
// Breakpoints
xs: {
  maxWidth: 660;
}
gtXs: {
  minWidth: 661;
}
sm: {
  maxWidth: 860;
}
gtSm: {
  minWidth: 861;
}
md: {
  maxWidth: 1020;
}
gtMd: {
  minWidth: 1021;
}
lg: {
  maxWidth: 1280;
}
gtLg: {
  minWidth: 1281;
}
xl: {
  maxWidth: 1420;
}
gtXl: {
  minWidth: 1421;
}
short: {
  maxHeight: 700;
}
tall: {
  minHeight: 701;
}
hoverNone: {
  hover: "none";
}
pointerCoarse: {
  pointer: "coarse";
}
```

## 🚀 Usage

### In Components

```tsx
import { Button } from "tamagui";

function MyButton() {
  return (
    <Button
      backgroundColor="$primary"
      color="$white"
      borderRadius="$md"
      padding="$md"
      hoverStyle={{
        backgroundColor: "$primaryHover",
      }}
      $md={{
        padding: "$lg",
      }}
    >
      Click me
    </Button>
  );
}
```

### In Styled Components

```tsx
import { styled, View } from "tamagui";

export const Card = styled(View, {
  backgroundColor: "$surface",
  padding: "$md",
  borderRadius: "$lg",
  borderWidth: 1,
  borderColor: "$border",

  variants: {
    elevated: {
      true: {
        shadowColor: "$shadowColor",
        shadowRadius: 8,
      },
    },
  },
});
```

## 🎨 Adding Custom Tokens

To extend the token system, modify `packages/config/src/tamagui.config.ts`:

### Adding Colors

```tsx
const brandColors = {
  // Add new colors
  purple500: "#a855f7",
  purple600: "#9333ea",
  // ...existing colors
};

const customTokens = createTokens({
  color: {
    ...brandColors,
    // Add semantic mapping
    accent: brandColors.purple500,
    accentHover: brandColors.purple600,
  },
});
```

### Adding Spacing

```tsx
const customTokens = createTokens({
  space: {
    ...defaultTokens.space,
    "4xl": 96,
    "5xl": 128,
  },
});
```

### Adding Sizes

```tsx
const customTokens = createTokens({
  size: {
    ...defaultTokens.size,
    avatarSm: 32,
    avatarMd: 48,
    avatarLg: 64,
  },
});
```

## 🎭 Customizing Themes

### Modifying Existing Themes

```tsx
const lightTheme = {
  ...defaultLightTheme,
  // Override specific values
  background: "#ffffff",
  primary: "#10b981", // Different shade
};

export const config = createTamagui({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
});
```

### Adding New Theme Variants

```tsx
const blueTheme = {
  background: "#eff6ff",
  color: "#1e40af",
  primary: "#3b82f6",
  // ... complete theme definition
};

export const config = createTamagui({
  themes: {
    light: lightTheme,
    dark: darkTheme,
    blue: blueTheme, // New theme
  },
});
```

### Using Custom Themes

```tsx
import { Theme } from "tamagui";

function App() {
  return (
    <Theme name="blue">
      <View backgroundColor="$background">
        <Text color="$color">Blue theme content</Text>
      </View>
    </Theme>
  );
}
```

## 🔧 Configuration Options

### Settings

```tsx
export const config = createTamagui({
  settings: {
    // Allow both shorthand and longhand props
    onlyAllowShorthands: false,

    // Enable automatic theme classes
    shouldAddPrefersColorThemes: true,
    themeClassNameOnRoot: true,

    // Dev optimizations
    fastSchemeChange: process.env.NODE_ENV === "development",
  },
});
```

## 📐 Design Decisions

### Color Scales

Each color family includes 10 shades (50-900):

- **50-300**: Light tones for backgrounds and subtle accents
- **400-600**: Mid-tones for primary usage
- **700-900**: Dark tones for text and strong accents

### Semantic Mappings

Colors are mapped semantically for consistent usage:

- `$primary`: Main brand color (green in our case)
- `$secondary`: Accent brand color (amber)
- `$success`: Positive feedback (teal)
- `$error`: Negative feedback (red)
- `$warning`: Cautionary feedback (amber)
- `$info`: Informational feedback (blue)

### State Variants

Each interactive color includes state variants:

- Base: Default state
- Hover: Mouse hover state
- Press: Active/pressed state
- Focus: Keyboard focus state

## 🔄 Migration Guide

### From Old Token Names

If migrating from older token names:

```tsx
// Old
backgroundColor: "$bg";
color: "$text";
borderColor: "$gray300";

// New (semantic)
backgroundColor: "$background";
color: "$text";
borderColor: "$border";
```

### Backward Compatibility

The config maintains backward compatibility with older token names:

- `$bg` → `$background`
- `$blue10` → `$blue500`
- `$muted` → `$textMuted`

## 🐛 Troubleshooting

### Config Changes Not Reflected

Config changes require server restart:

```bash
# Stop dev server, then restart
pnpm dev:web
# or
pnpm dev:mobile --clear
```

### Type Errors

If you get type errors about missing tokens:

1. Restart TypeScript server in your IDE
2. Run `pnpm typecheck` to verify
3. Ensure config is properly exported

### Missing Tokens

Check that custom tokens are:

1. Added to `customTokens`
2. Exported in the config
3. Properly typed in the Tamagui declaration

## 📚 Resources

- [Tamagui Configuration Docs](https://tamagui.dev/docs/core/configuration)
- [Tamagui Theme Builder](https://tamagui.dev/theme)
- [Design Tokens Guide](https://tamagui.dev/docs/core/tokens)

## 🤝 Contributing

When modifying the config:

1. **Add tokens** with proper semantic names
2. **Test both themes** (light and dark)
3. **Update this README** with new tokens
4. **Run type checks** to ensure no breaking changes
5. **Document breaking changes** in PR description

## 📄 License

Part of the ButterGolf monorepo. Private package.
