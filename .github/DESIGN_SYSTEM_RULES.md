# ButterGolf Design System Rules for Figma MCP Integration

> This document defines the design system structure and patterns for ButterGolf, enabling seamless integration of Figma designs via the Model Context Protocol (MCP).

---

## 1. Token Definitions

### Location

Design tokens are defined in a dedicated configuration package:

- **Primary Config**: `packages/config/src/tamagui.config.ts`
- **Brand Colors Export**: `packages/config/src/brand-colors.ts` (raw values for third-party integrations)

### Token Structure

#### Color Tokens

All colors use a semantic naming convention with brand-specific base colors:

```typescript
// Brand Colors (Source of Truth)
const brandColors = {
  // Primary - Spiced Clementine (vibrant orange)
  spicedClementine: "#F45314",
  spicedClementineHover: "#D9450F",
  spicedClementinePress: "#BF3A0D",

  // Primary Light - Vanilla Cream (light background)
  vanillaCream: "#FFFAD2",
  vanillaCreamHover: "#FFF8C5",
  vanillaCreamPress: "#FFF6B8",

  // Secondary - Burnt Olive (dark accent)
  burntOlive: "#3E3B2C",
  burntOliveHover: "#353226",
  burntOlivePress: "#2C291F",

  // Tertiary - Lemon Haze (subtle accent)
  lemonHaze: "#EDECC3",
  lemonHazeHover: "#E5E4B5",
  lemonHazePress: "#DDDBA7",

  // Neutral Light - Cloud Mist (borders/dividers)
  cloudMist: "#EDEDED",
  cloudMistHover: "#E0E0E0",
  cloudMistPress: "#D3D3D3",

  // Neutral Medium - Slate Smoke (secondary text)
  slateSmoke: "#545454",

  // Neutral Dark - Ironstone (primary text)
  ironstone: "#323232",

  // Pure White
  pureWhite: "#FFFFFF",

  // Status Colors
  success: "#02aaa4", // Teal
  error: "#dc2626", // Red
  warning: "#F45314", // Uses primary (Spiced Clementine)
  info: "#3c50e0", // Blue
};
```

#### Semantic Token Mapping

Always use semantic tokens in application code for automatic theme switching:

| Semantic Token   | Light Theme Value           | Dark Theme Value      |
| ---------------- | --------------------------- | --------------------- |
| `$primary`       | #F45314 (Spiced Clementine) | #F45314               |
| `$secondary`     | #3E3B2C (Burnt Olive)       | #EDECC3 (Lemon Haze)  |
| `$background`    | #FFFFFF (Pure White)        | #3E3B2C (Burnt Olive) |
| `$text`          | #323232 (Ironstone)         | #FFFFFF               |
| `$textSecondary` | #545454 (Slate Smoke)       | #EDEDED               |
| `$textMuted`     | #EDEDED (Cloud Mist)        | #545454               |
| `$textInverse`   | #FFFFFF                     | #323232               |
| `$surface`       | #FFFFFF                     | #323232               |
| `$border`        | #EDEDED (Cloud Mist)        | #545454               |

#### Spacing Tokens

```typescript
const space = {
  xs: 4, // $xs
  sm: 8, // $sm
  md: 16, // $md
  lg: 24, // $lg
  xl: 32, // $xl
  "2xl": 48, // $2xl
  "3xl": 64, // $3xl
};
```

#### Size Tokens (Component Dimensions)

```typescript
const size = {
  buttonSm: 32, // $buttonSm
  buttonMd: 40, // $buttonMd
  buttonLg: 48, // $buttonLg
  inputSm: 32, // $inputSm
  inputMd: 40, // $inputMd
  inputLg: 48, // $inputLg
  iconSm: 16, // $iconSm
  iconMd: 20, // $iconMd
  iconLg: 24, // $iconLg
  iconXl: 32, // $iconXl
};
```

#### Radius Tokens

```typescript
const radius = {
  xs: 3, // $xs
  sm: 6, // $sm
  md: 10, // $md
  lg: 14, // $lg
  xl: 18, // $xl
  "2xl": 26, // $2xl
  full: 9999, // $full (pill shape)
};
```

#### Typography Size Scale (Font Sizes)

Uses numeric tokens `$1` through `$16`:

| Token  | Body Font | Heading Font | Use Case                |
| ------ | --------- | ------------ | ----------------------- |
| `$1`   | 11px      | 12px         | Legal text              |
| `$2`   | 12px      | 14px         | Captions                |
| `$3`   | 13px      | 16px         | Small labels            |
| `$4`   | 14px      | 18px         | Body small, helper text |
| `$5`   | 15px      | 20px         | **Body default**        |
| `$6`   | 16px      | 24px         | Large body              |
| `$7`   | 18px      | 28px         | Subheadings             |
| `$8`   | 20px      | 32px         | Large subheadings       |
| `$9`   | 22px      | 40px         | h2 headings             |
| `$10`  | 24px      | 48px         | h1 headings             |
| `$11`  | 28px      | 56px         | Large headings          |
| `$12`  | 32px      | 64px         | XL headings             |
| `$13+` | 40px+     | 72px+        | Hero text               |

---

## 2. Component Library

### Location

- **Package**: `packages/ui/`
- **Components**: `packages/ui/src/components/`
- **Entry Point**: `packages/ui/src/index.ts`

### Architecture

- Built on **Tamagui** for cross-platform (web + React Native) compatibility
- Uses `styled()` function with `name` property for compiler optimization
- Compound component pattern for complex components (e.g., Card)

### Available Components

#### Core Components

| Component      | Location           | Description                            |
| -------------- | ------------------ | -------------------------------------- |
| `Button`       | `Button.tsx`       | Primary/secondary buttons with shadows |
| `AuthButton`   | `AuthButton.tsx`   | Authentication-specific buttons        |
| `Text`         | `Text.tsx`         | Body text with weight/align variants   |
| `Heading`      | `Text.tsx`         | h1-h6 headings with level prop         |
| `Label`        | `Text.tsx`         | Form labels                            |
| `Input`        | `Input.tsx`        | Text inputs with size variants         |
| `Select`       | `Select.tsx`       | Dropdown select                        |
| `TextArea`     | `TextArea.tsx`     | Multi-line text input                  |
| `Checkbox`     | `Checkbox.tsx`     | Checkbox control                       |
| `Radio`        | `Radio.tsx`        | Radio button group                     |
| `Slider`       | `Slider.tsx`       | Range slider                           |
| `Autocomplete` | `Autocomplete.tsx` | Autocomplete input                     |

#### Layout Components

| Component                  | Location     | Description                         |
| -------------------------- | ------------ | ----------------------------------- |
| `Row`                      | `Layout.tsx` | Horizontal flex container (XStack)  |
| `Column`                   | `Layout.tsx` | Vertical flex container (YStack)    |
| `Container`                | `Layout.tsx` | Max-width wrapper (sm/md/lg/xl/2xl) |
| `Spacer`                   | `Layout.tsx` | Flexible space                      |
| `View`, `XStack`, `YStack` | `Layout.tsx` | Raw Tamagui primitives              |

#### Card Components (Compound)

| Component           | Location                | Description                                              |
| ------------------- | ----------------------- | -------------------------------------------------------- |
| `Card`              | `Card.tsx`              | Container with variants (elevated/outlined/filled/ghost) |
| `Card.Header`       | `Card.tsx`              | Card header section                                      |
| `Card.Body`         | `Card.tsx`              | Card main content                                        |
| `Card.Footer`       | `Card.tsx`              | Card footer with alignment                               |
| `GlassmorphismCard` | `GlassmorphismCard.tsx` | Glass effect card                                        |

#### Feedback Components

| Component | Location      | Description                                        |
| --------- | ------------- | -------------------------------------------------- |
| `Badge`   | `Badge.tsx`   | Status badges (primary/success/error/warning/info) |
| `Spinner` | `Spinner.tsx` | Loading indicator                                  |

#### Media Components

| Component    | Location         | Description          |
| ------------ | ---------------- | -------------------- |
| `Image`      | `Image.tsx`      | Cross-platform image |
| `ScrollView` | `ScrollView.tsx` | Scrollable container |

---

## 3. Frameworks & Libraries

### UI Framework

- **Tamagui** v1.135.7 - Cross-platform UI components and theming
- React 19.x (aligned across web and mobile)
- React Native 0.81.5

### Styling Libraries

- **Tamagui** - Primary styling (tokens, themes, variants)
- **Tailwind CSS v4** - Web-only supplementary styling

### Build Systems

- **Turborepo** 2.6.0 - Monorepo orchestration
- **pnpm** 10.20.0 - Package manager with workspaces
- **Metro** - Mobile bundler (Expo)
- **Webpack** - Web bundler (Next.js)

### App Platforms

| Platform | Location       | Framework                   |
| -------- | -------------- | --------------------------- |
| Web      | `apps/web/`    | Next.js 16.0.1 (App Router) |
| Mobile   | `apps/mobile/` | Expo ~54.0.20               |

---

## 4. Asset Management

### Static Assets Location

- **Web**: `apps/web/public/`
- **Backgrounds**: `apps/web/public/backgrounds/`

### Available Assets

```
public/
├── logo-orange-on-white.svg   # Primary logo (orange on white)
├── logo-orange.png            # Orange logo
├── logo-white.png             # White logo (for colored backgrounds)
├── favicon.ico
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── apple-touch-icon.png
├── site.webmanifest
└── backgrounds/               # Pattern backgrounds
```

### Image CDN

- **Provider**: Cloudinary
- **Packages**: `cloudinary`, `next-cloudinary`
- **Features**: AI background removal, format optimization, CDN delivery

### Asset Optimization

- Images uploaded to Cloudinary receive automatic format/quality optimization
- First product image gets AI background removal with Vanilla Cream (#FFFAD2) replacement
- Responsive images via URL transformations

---

## 5. Icon System

### Icon Library

- **Package**: `@tamagui/lucide-icons`
- **Source**: Lucide Icons (fork of Feather Icons)

### Usage Pattern

```tsx
import { Package, Truck, MapPin, CheckCircle } from "@tamagui/lucide-icons";

// Usage
<Package size={24} color="$primary" />
<Truck size="$iconMd" color="$textSecondary" />
```

### Icon Size Tokens

| Token     | Size | Use Case                 |
| --------- | ---- | ------------------------ |
| `$iconSm` | 16px | Small inline icons       |
| `$iconMd` | 20px | Default icons            |
| `$iconLg` | 24px | Button icons, navigation |
| `$iconXl` | 32px | Feature icons            |

### Naming Convention

- Import icons directly by name from `@tamagui/lucide-icons`
- Use semantic names (e.g., `ShoppingBag`, `Package`, `Eye`, `Download`)
- Size with tokens or numeric values
- Color with semantic tokens (`$primary`, `$textSecondary`, etc.)

---

## 6. Styling Approach

### Primary: Tamagui Tokens

All styling uses Tamagui's token system with the `$` prefix:

```tsx
// ✅ CORRECT - Use semantic tokens
<View
  backgroundColor="$background"
  padding="$md"
  borderRadius="$lg"
  borderColor="$border"
/>

// ❌ WRONG - Never use raw hex values in app code
<View backgroundColor="#F45314" padding={16} />
```

### Component Styling with styled()

```tsx
import { styled, GetProps } from "tamagui";

const MyComponent = styled(View, {
  name: "MyComponent", // Required for compiler optimization

  // Base styles using tokens
  backgroundColor: "$surface",
  borderRadius: "$md",
  padding: "$md",

  // Interactive states
  hoverStyle: { backgroundColor: "$backgroundHover" },
  pressStyle: { scale: 0.98 },
  focusStyle: { borderColor: "$borderFocus" },

  // Variants
  variants: {
    size: {
      sm: { padding: "$sm" },
      md: { padding: "$md" },
      lg: { padding: "$lg" },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

export type MyComponentProps = GetProps<typeof MyComponent>;
```

### Responsive Design

Tamagui media queries with `$gtXx` prefix:

```tsx
<View
  width="100%"
  $gtSm={{ width: "50%" }} // > 800px
  $gtMd={{ width: "33%" }} // > 1020px
  $gtLg={{ width: "25%" }} // > 1280px
/>
```

### Media Breakpoints

| Key   | Max Width | Use Case      |
| ----- | --------- | ------------- |
| `xs`  | 660px     | Small phones  |
| `sm`  | 800px     | Large phones  |
| `md`  | 1020px    | Tablets       |
| `lg`  | 1280px    | Small laptops |
| `xl`  | 1420px    | Desktops      |
| `xxl` | 1600px    | Large screens |

---

## 7. Project Structure

```
buttergolf/
├── apps/
│   ├── web/                    # Next.js 16 web app
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   │   ├── _components/ # App-specific components
│   │   │   │   ├── api/        # API routes
│   │   │   │   └── [routes]/   # Page routes
│   │   │   ├── components/     # Shared web components
│   │   │   ├── hooks/          # React hooks
│   │   │   └── lib/            # Utilities
│   │   └── public/             # Static assets
│   │
│   └── mobile/                 # Expo React Native app
│       ├── App.tsx             # Entry point + navigation
│       └── app.json            # Expo config
│
├── packages/
│   ├── config/                 # Tamagui configuration
│   │   └── src/
│   │       ├── tamagui.config.ts  # Theme & tokens
│   │       ├── brand-colors.ts    # Raw color exports
│   │       ├── animations.ts      # Web animations
│   │       └── animations.native.ts # Mobile animations
│   │
│   ├── ui/                     # Shared UI components
│   │   └── src/
│   │       ├── components/     # Component files
│   │       └── index.ts        # Exports
│   │
│   ├── app/                    # Shared screens (Solito)
│   │   └── src/
│   │       ├── features/       # Feature screens
│   │       └── navigation/     # Route definitions
│   │
│   ├── db/                     # Prisma database
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   ├── eslint-config/          # Shared ESLint
│   └── typescript-config/      # Shared TypeScript
│
└── docs/                       # Documentation
```

### Feature Organization

Features are organized by domain with co-located components:

```
apps/web/src/app/
├── _components/          # Shared page components
│   ├── header/           # Header components
│   ├── marketplace/      # Marketplace components
│   └── shared/           # Common utilities
├── category/[slug]/      # Category pages
├── products/[id]/        # Product pages
├── orders/               # Order management
├── sell/                 # Seller flow
└── ...
```

---

## 8. Figma to Code Mapping

### Color Token Mapping

When translating Figma designs to code:

| Figma Color                 | Token                              |
| --------------------------- | ---------------------------------- |
| Spiced Clementine (#F45314) | `$primary`                         |
| Vanilla Cream (#FFFAD2)     | `$vanillaCream` or `$primaryLight` |
| Burnt Olive (#3E3B2C)       | `$secondary`                       |
| Lemon Haze (#EDECC3)        | `$lemonHaze` or `$secondaryLight`  |
| Cloud Mist (#EDEDED)        | `$border` or `$cloudMist`          |
| Slate Smoke (#545454)       | `$textSecondary` or `$slateSmoke`  |
| Ironstone (#323232)         | `$text` or `$ironstone`            |
| Pure White (#FFFFFF)        | `$surface` or `$pureWhite`         |

### Component Mapping

| Figma Element    | Tamagui Component                    | Props                |
| ---------------- | ------------------------------------ | -------------------- |
| Primary Button   | `<Button butterVariant="primary">`   | borderRadius="$full" |
| Secondary Button | `<Button butterVariant="secondary">` | borderRadius="$full" |
| Text Input       | `<Input size="md">`                  | borderRadius={24}    |
| Card             | `<Card variant="elevated">`          | padding="$md"        |
| Heading          | `<Heading level={n}>`                | level={1-6}          |
| Body Text        | `<Text size="$5">`                   | size="$4" to "$7"    |

### Spacing Translation

| Figma Spacing | Token         |
| ------------- | ------------- |
| 4px           | `$xs` or `$1` |
| 8px           | `$sm` or `$2` |
| 16px          | `$md` or `$4` |
| 24px          | `$lg` or `$6` |
| 32px          | `$xl` or `$8` |
| 48px          | `$2xl`        |
| 64px          | `$3xl`        |

---

## 9. Code Generation Guidelines

### Import Pattern

```tsx
// Always import from @buttergolf/ui
import { Button, Text, Heading, Card, Row, Column, Input, Badge } from "@buttergolf/ui";

// Icons from @tamagui/lucide-icons
import { ShoppingBag, Heart, User } from "@tamagui/lucide-icons";
```

### Button Generation

```tsx
// Primary button (Spiced Clementine)
<Button butterVariant="primary" size="$5">
  Sell now
</Button>

// Secondary button (Ironstone)
<Button butterVariant="secondary" size="$4">
  Shop now
</Button>

// For non-styled buttons, use direct props:
<Button
  size="$4"
  backgroundColor="$primary"
  color="$textInverse"
  borderRadius="$full"
>
  Action
</Button>
```

### Typography Generation

```tsx
// Body text (use size with numeric tokens)
<Text size="$5">Regular body text</Text>
<Text size="$4" color="$textSecondary">Helper text</Text>

// Headings (use level prop)
<Heading level={1}>Page Title</Heading>
<Heading level={2}>Section Title</Heading>
<Heading level={3}>Subsection</Heading>
```

### Layout Generation

```tsx
<Container size="lg" paddingHorizontal="$md">
  <Column gap="$lg">
    <Row gap="$md" alignItems="center" justifyContent="space-between">
      <Text>Left content</Text>
      <Button>Right action</Button>
    </Row>
  </Column>
</Container>
```

### Card Generation

```tsx
<Card variant="elevated" padding="$md">
  <Card.Header>
    <Heading level={3}>Title</Heading>
  </Card.Header>
  <Card.Body>
    <Text>Content goes here</Text>
  </Card.Body>
  <Card.Footer align="right">
    <Button butterVariant="primary">Action</Button>
  </Card.Footer>
</Card>
```

---

## 10. Critical Rules

### DO ✅

- Use semantic tokens (`$primary`, `$text`, `$background`) in app code
- Use `butterVariant="primary|secondary"` for styled buttons
- Use `size="$n"` (numeric tokens) for Text/Heading
- Use `level={1-6}` for Heading semantic levels
- Use `size="sm|md|lg"` for Input, Badge, Spinner components
- Use compound components (`Card.Header`, `Card.Body`, `Card.Footer`)
- Use `Row`/`Column` for layouts instead of raw `XStack`/`YStack`
- Include `name` property in `styled()` for compiler optimization
- Use `@tamagui/lucide-icons` for icons

### DON'T ❌

- Never use raw hex values in application code
- Never use `fontSize` prop on Text (use `size` prop)
- Never use named sizes on Text (`size="md"` is wrong, use `size="$5"`)
- Never use `variant` prop on Button (use `butterVariant`)
- Never import from `@prisma/client` (use `@buttergolf/db`)
- Never use numbered color tokens (`$color9`, `$blue10`)
- Never create manual HTML buttons with inline styles
- Never mix Tamagui and raw CSS in shared components

### Font Family

- **Primary Font**: Urbanist
- Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- Token: `fontFamily="$body"` or `fontFamily="$heading"`

### British Spelling

This project uses British English spelling conventions:

- Use `favourite` not `favorite`
- Use `colour` not `color` (in variable names, not CSS properties)
- ESLint enforces this via `no-restricted-syntax` rules
