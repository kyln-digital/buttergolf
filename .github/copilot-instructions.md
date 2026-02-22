# Copilot Instructions for ButterGolf

## Project Overview

ButterGolf is a cross-platform application built with a modern monorepo architecture, supporting both web (Next.js) and mobile (Expo) platforms. The project leverages Tamagui for cross-platform UI components and styling, ensuring a consistent user experience across all platforms.

This guide also documents our authentication setup using Clerk for both platforms, how it integrates with Prisma, and patterns to follow when adding new features in this turborepo.

## Architecture

### Monorepo Structure

- **Build System**: Turborepo 2.6.0 for build orchestration and caching
- **Package Manager**: pnpm 10.20.0 with workspace protocol
- **Apps**:
  - `apps/web` - Next.js 16.0.1 (App Router) web application
  - `apps/mobile` - Expo ~54.0.20 mobile application (iOS/Android)
- **Packages**:
  - `packages/ui` - Shared Tamagui-based cross-platform UI components
  - `packages/db` - Prisma database client and schema (PostgreSQL)
  - `packages/eslint-config` - Shared ESLint configurations
  - `packages/typescript-config` - Shared TypeScript configurations

### Technology Stack

- **UI Framework**: Tamagui 2.0.0-rc.16 for cross-platform UI components and theming
  - Migrated from v1 (1.144.3 → 2.0.0-rc.16) — see `docs/tamagui-v2-migration.md` for full changelog and break-fix guide
  - v2 API changes to be aware of: `Stack` removed (use `YStack`/`XStack`), `children` typed as `Variable<any>` (upstream RC issue), CSS-only props (`transition`, `overflow`) must move to the `style` prop, `editable` replaced by `disabled` on Input/TextArea, `placeholderTextColor` accepts only token strings
  - Web bundle uses `@tamagui/react-native-web-lite` alias for ~40 % payload reduction (see `docs/web-bundle-optimisation.md`)
- **Database**: Prisma 6.x with PostgreSQL
- **React**: 19.x (aligned across web and mobile)
- **React Native**: 0.81.5
- **React Native Web**: 0.21.2 (enables React Native components on web)
- **TypeScript**: 5.9.2 (strict mode)
- **Styling**: Tailwind CSS v4 (web), Tamagui (cross-platform)
- **Navigation**: Solito 5.0.0 for unified cross-platform routing
- **Bundlers**:
  - Metro (mobile) - custom workspace-aware configuration
  - Webpack (Next.js)
- **Babel**: Custom configuration with `@tamagui/babel-plugin`
- **Auth**: Clerk 6.34.1 (Web: `@clerk/nextjs`, Mobile: `@clerk/clerk-expo` 2.17.3)
- **Payments**: Stripe 19.2.1 (Web: `stripe` + `@stripe/stripe-js` + `@stripe/react-stripe-js`, Mobile: `@stripe/stripe-react-native`)
- **Image CDN**: Cloudinary (`cloudinary` + `next-cloudinary`) for image uploads, hosting, and transformations

**CRITICAL: Next.js 16+ Middleware Convention**

- Next.js 16.0.1+ uses `src/proxy.ts` NOT `src/middleware.ts`
- The middleware file convention was renamed in Next.js 16
- Always use `proxy.ts` for route protection and middleware logic

### Cross-Platform Navigation Architecture (CRITICAL)

**THIS IS A SOLITO-BASED MONOREPO - NOT EXPO ROUTER**

The navigation architecture uses **Solito** to share routing logic between Next.js (web) and React Navigation (mobile):

**Package Structure:**

- `packages/app/` - **Shared cross-platform screens and business logic** (works on both web and mobile)
  - Contains: screens, components, hooks, types, navigation config
  - Uses: `solito/link` and `solito/navigation` for platform-agnostic navigation
  - Example: `packages/app/src/features/categories/category-list-screen.tsx`
- `apps/web/` - **Next.js App Router** (file-based routing with `app/` directory)
  - Solito automatically translates to Next.js `<Link>` and `useRouter()`
  - Example: `apps/web/src/app/category/[slug]/page.tsx`
- `apps/mobile/` - **Expo + React Navigation** (`App.tsx` entry point, NO `app/` directory)
  - Solito translates to React Navigation via linking config in `App.tsx`
  - Must manually register screens in the Stack Navigator
  - Example: Add `<Stack.Screen name="Category">` in `apps/mobile/App.tsx`

**Route Definition (Single Source of Truth):**

```typescript
// packages/app/src/navigation/routes.ts
export const routes = {
  home: "/",
  category: "/category/[slug]",
  productDetail: "/products/[id]",
  // ... other routes
};
```

**How to Add a New Screen:**

1. **Define the route** in `packages/app/src/navigation/routes.ts`
2. **Create the screen component** in `packages/app/src/features/[feature]/[screen-name].tsx`
   - Use `useLink` from `solito/navigation` for navigation
   - Must be platform-agnostic (use Tamagui, not web-specific or native-specific APIs)
3. **Export from** `packages/app/src/index.ts` or feature-specific index
4. **Web (automatic):** Create matching route in `apps/web/src/app/[route]/page.tsx`
   - Import and render the shared screen component
   - Solito handles the rest automatically
5. **Mobile (manual):** Register in `apps/mobile/App.tsx`:

   ```typescript
   import { MyNewScreen } from "@buttergolf/app/src/features/[feature]";

   // Add to linking config
   const linking = {
     config: {
       screens: {
         MyNewScreen: { path: "my-route/:param" }
       }
     }
   }

   // Add to Stack Navigator
   <Stack.Screen name="MyNewScreen">
     {({ route }) => (
       <MyNewScreen
         param={route.params?.param}
         onFetchData={fetchDataFunction}
       />
     )}
   </Stack.Screen>
   ```

**Common Mistakes to Avoid:**

- ❌ Don't expect Expo Router file-based routing in `apps/mobile/` - it uses React Navigation
- ❌ Don't create separate screens for web and mobile - use shared `packages/app/` screens
- ❌ Don't forget to register new routes in BOTH the linking config AND Stack Navigator in `App.tsx`
- ❌ Don't use Next.js-specific APIs in `packages/app/` (e.g., `next/image`, `next/navigation`)
- ❌ Don't use React Native-specific APIs in `packages/app/` unless wrapped in Platform checks
- ✅ DO use Solito's `useLink` and `Link` components for all navigation
- ✅ DO use Tamagui components for UI (they work everywhere)
- ✅ DO pass data fetching functions as props (keeps screens platform-agnostic)

## Critical Commands

```bash
# Development
pnpm dev:web       # Start Next.js dev server (localhost:3000)
pnpm dev:mobile    # Start Expo dev server

# Building
pnpm build         # Build all apps and packages
pnpm build:web     # Build web app only
pnpm build:mobile  # Build mobile app only

# Type checking
pnpm typecheck   # Run TypeScript compiler across workspace

# Cleaning
pnpm clean-install # Remove node_modules and reinstall dependencies
pnpm clean         # Clean build outputs

# Linting
pnpm lint          # Lint all packages

# Database (Prisma)
pnpm db:generate        # Generate Prisma Client
pnpm db:migrate:dev     # Create and apply migration
pnpm db:studio          # Open Prisma Studio GUI
pnpm db:seed            # Seed database with sample data

# Auth (Clerk)
# See docs/AUTH_SETUP_CLERK.md for details. Ensure env vars are set before running apps.
```

## Package Naming Convention

All internal packages use the `@buttergolf/` namespace:

- `@buttergolf/ui` - Cross-platform UI components
- `@buttergolf/db` - Prisma database client
- `@buttergolf/eslint-config` - Shared ESLint configurations
- `@buttergolf/typescript-config` - Shared TypeScript configurations
- Use workspace protocol: `"@buttergolf/ui": "workspace:*"`

## Tamagui Configuration & Theme System

### Core Config Location

- **Config Package**: `packages/config` - Dedicated package for Tamagui configuration
- **Config File**: `packages/config/src/tamagui.config.ts` (source of truth)
- **Base Config**: Extends `@tamagui/config/v4` (Tamagui v2 package, config schema is still named v4)
- **Re-export**: `packages/ui/tamagui.config.ts` - Thin re-export for backward compatibility
- **TypeScript Paths**: Defined in `/tsconfig.base.json`

**Note**: The dedicated `@buttergolf/config` package allows proper versioning and reusability across the monorepo.

### Complete Token System

Our design system uses a comprehensive token system with semantic naming for maintainability and theme consistency.

#### Color Tokens

**Brand Colors (Figma Specification)**:

```tsx
// Primary - Spiced Clementine (vibrant orange)
$spicedClementine: #F45314
$primary: $spicedClementine      // Main brand color
$primaryHover: $spicedClementineHover // Hover state
$primaryPress: $spicedClementinePress // Press/active state
$primaryFocus: $spicedClementine      // Focus state

// Primary Light - Vanilla Cream (light background)
$vanillaCream: #FFFAD2
$primaryLight: $vanillaCream     // Light variant for backgrounds

// Secondary - Burnt Olive (dark accent)
$burntOlive: #3E3B2C
$secondary: $burntOlive          // Main secondary color
$secondaryLight: $lemonHaze      // Light secondary (Lemon Haze)
$secondaryHover: $burntOliveHover
$secondaryPress: $burntOlivePress
$secondaryFocus: $burntOlive

// Tertiary - Lemon Haze (subtle accent)
$lemonHaze: #EDECC3

// Neutral Colors
$cloudMist: #EDEDED    // Light borders/dividers
$slateSmoke: #545454   // Secondary text
$ironstone: #323232    // Primary text
$pureWhite: #FFFFFF    // Base white
```

**Semantic Status Colors**:

```tsx
$success: $successBase; // Teal (#02aaa4) - Positive actions/states
$successLight: $successLight; // Light background
$successDark: $successDark; // Dark variant

$error: $errorBase; // Red (#dc2626) - Error states
$errorLight: $errorLight; // Error backgrounds
$errorDark: $errorDark; // Dark error

$warning: $warningBase; // Spiced Clementine - Warning states
$warningLight: $warningLight;
$warningDark: $warningDark;

$info: $infoBase; // Blue (#3c50e0) - Informational states
$infoLight: $infoLight;
$infoDark: $infoDark;
```

**Opacity Overlays**:

```tsx
// Light overlays (for dark backgrounds like Burnt Olive)
$overlayLight10: rgba(255, 255, 255, 0.1);
$overlayLight20: rgba(255, 255, 255, 0.2);
$overlayLight30: rgba(255, 255, 255, 0.3);
$overlayLight40: rgba(255, 255, 255, 0.4);
$overlayLight60: rgba(255, 255, 255, 0.6);

// Dark overlays (for light backgrounds like Vanilla Cream)
$overlayDark5: rgba(0, 0, 0, 0.05);
$overlayDark10: rgba(0, 0, 0, 0.1);
$overlayDark20: rgba(0, 0, 0, 0.2);
$overlayDark30: rgba(0, 0, 0, 0.3);
$overlayDark50: rgba(0, 0, 0, 0.5);
```

**Text Colors (Semantic)**:

```tsx
$text: $ironstone; // Primary text (#323232 - Ironstone)
$textSecondary: #4A4A4A; // Secondary text
$textTertiary: $gray600; // Tertiary text
$textMuted: $gray500; // Muted/placeholder text
$textInverse: $white; // Text on dark backgrounds
```

**Background Colors**:

```tsx
$background: $vanillaCream; // Main app background (#FFFAD2 - Vanilla Cream)
$backgroundHover; // Hover state backgrounds
$backgroundPress; // Press state backgrounds
$backgroundFocus; // Focus state backgrounds
$surface: $pureWhite; // Surface/card backgrounds
$card: $pureWhite; // Card-specific background
$cardHover; // Card hover state
```

**Border Colors**:

```tsx
$border: $cloudMist; // Default borders (#EDEDED)
$borderHover: $cloudMistHover; // Hover state borders
$borderFocus: $spicedClementine; // Focus state borders (uses primary)
$borderPress: $spicedClementinePress; // Press state borders
```

**Shadow Colors**:

```tsx
$shadowColor; // Default shadow
$shadowColorHover; // Hover state shadow
$shadowColorPress; // Press state shadow
$shadowColorFocus; // Focus state shadow (with primary tint)
```

#### Spacing Tokens

```tsx
$xs: 4px
$sm: 8px
$md: 16px
$lg: 24px
$xl: 32px
$2xl: 48px
$3xl: 64px
```

#### Size Tokens

```tsx
// Component-specific sizes
$buttonSm: 32px
$buttonMd: 40px
$buttonLg: 48px
$inputSm: 32px
$inputMd: 40px
$inputLg: 48px
$iconSm: 16px
$iconMd: 20px
$iconLg: 24px
$iconXl: 32px
```

#### Radius Tokens

```tsx
$xs: 3px      // was 2px - softer, more playful
$sm: 6px      // was 4px
$md: 10px     // was 8px
$lg: 14px     // was 12px
$xl: 18px     // was 16px
$2xl: 26px    // was 24px
$full: 9999px // Perfect circles
```

#### Z-Index Tokens

```tsx
$dropdown: 1000;
$sticky: 1020;
$fixed: 1030;
$modalBackdrop: 1040;
$modal: 1050;
$popover: 1060;
$tooltip: 1070;
```

### Theme System

**Light Theme** (default):

- Background: Vanilla Cream (#FFFAD2) - soft, warm light background
- Text: Ironstone (#323232) - dark, readable primary text
- Primary: Spiced Clementine (#F45314) - vibrant orange for brand consistency
- Secondary: Burnt Olive (#3E3B2C) - dark accent
- All semantic colors optimized for light backgrounds

**Dark Theme**:

- Background: Burnt Olive (#3E3B2C) - warm, earthy dark background
- Text: Pure White (#FFFFFF) - high contrast for readability
- Primary: Spiced Clementine (#F45314) - maintains vibrant brand presence
- Secondary: Lemon Haze (#EDECC3) - light accent on dark
- All semantic colors adjusted for dark backgrounds with proper contrast

**Sub-Themes for State Changes**:

Tamagui automatically looks for sub-themes matching the pattern `[currentTheme]_[subThemeName]`. We have the following sub-themes:

- `light_active` / `dark_active` - For active/selected states (menu items, tabs, etc.)
- `light_error` / `dark_error` - For error states
- `light_success` / `dark_success` - For success states
- `light_warning` / `dark_warning` - For warning states

**Theme Switching & State-Based Styling**:

```tsx
import { Theme } from "tamagui";

// ✅ CORRECT - Use Theme component for state-based styling
<Theme name={isActive ? "active" : null}>
  <Text>Menu Item</Text>  {/* Automatically gets active theme colors */}
</Theme>

// ✅ CORRECT - Static theme switching
<Theme name="dark">
  <View backgroundColor="$background">
    <Text color="$text">Automatically uses dark theme tokens</Text>
  </View>
</Theme>

// ❌ WRONG - Don't use conditional variant props (causes TypeScript errors)
<Text color={isActive ? "primary" : "default"}>Menu Item</Text>

// ❌ WRONG - Don't use conditional expressions with variants
const color: "primary" | "default" = isActive ? "primary" : "default"
<Text color={color}>Menu Item</Text>
```

**Key Learning**: When you need to change styling based on state (active, hover, selected, etc.), wrap the component in a `<Theme>` component instead of using conditional variant props. This is type-safe, performant, and the proper Tamagui pattern.

### Key Tamagui Concepts

#### Component Creation

```tsx
// Use styled() for optimized components
import { View, styled } from "tamagui";

export const Button = styled(View, {
  name: "Button", // Required for compiler optimization
  backgroundColor: "$background",
  pressStyle: {
    backgroundColor: "$backgroundPress",
  },
  variants: {
    size: {
      sm: { height: "$8", paddingHorizontal: "$3" },
      md: { height: "$10", paddingHorizontal: "$4" },
      lg: { height: "$12", paddingHorizontal: "$5" },
    },
  },
});
```

#### Theme Access

```tsx
import { useTheme } from "tamagui";

function MyComponent() {
  const theme = useTheme();
  return <View backgroundColor={theme.background.val} />;
}
```

#### Token Usage

- Prefix tokens with `$`: `fontSize="$lg"`, `padding="$4"`
- Tokens are defined in your Tamagui config
- Available token categories: `size`, `space`, `color`, `radius`, `zIndex`

### Tamagui Package Structure

The `@buttergolf/ui` package is source-first (no build step):

```json
{
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**Important**: Components must be re-exports from Tamagui packages:

```tsx
// packages/ui/src/components/Button.tsx
export { Button } from "@tamagui/button";
export type { ButtonProps } from "@tamagui/button";
```

## Platform-Specific Patterns

### Next.js (Web) Configuration

**Key Files**:

- `/apps/web/next.config.ts`
- `/apps/web/src/app/layout.tsx`

**Critical Next.js + Tamagui Setup**:

```typescript
// next.config.ts
const config: NextConfig = {
  transpilePackages: ["@buttergolf/ui", "react-native-web", "@tamagui/core", "tamagui"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native$": "react-native-web",
    };
    return config;
  },
};
```

**Root Layout Pattern**:

```tsx
// apps/web/src/app/layout.tsx
import { TamaguiProvider } from "tamagui";
import { config } from "@buttergolf/config";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TamaguiProvider config={config} defaultTheme="light">
          {children}
        </TamaguiProvider>
      </body>
    </html>
  );
}
```

### Expo (Mobile) Configuration

**Key Files**:

- `/apps/mobile/metro.config.js`
- `/apps/mobile/babel.config.js`
- `/apps/mobile/App.tsx`

**Metro Configuration**:
The Metro config is workspace-aware and watches the root:

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
```

**Babel Configuration**:

```javascript
// babel.config.js
module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          "@buttergolf/ui": "../../packages/ui/src",
        },
      },
    ],
    "tamagui/babel",
  ],
};
```

## Cross-Platform Component Patterns

### Import Pattern

```tsx
// Always import from @buttergolf/ui for cross-platform components
import { Button, Text } from "@buttergolf/ui";

function MyScreen() {
  return (
    <View>
      <Text>Hello World</Text>
      <Button onPress={() => console.log("pressed")}>Click me</Button>
    </View>
  );
}
```

### Tamagui Provider Usage

Both platforms require wrapping the app in `TamaguiProvider`:

```tsx
import { TamaguiProvider } from "tamagui";
import { config } from "@buttergolf/config";

function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      {/* Your app */}
    </TamaguiProvider>
  );
}
```

### Media Queries (Cross-Platform)

```tsx
import { useMedia } from "tamagui";

function ResponsiveComponent() {
  const media = useMedia();

  return (
    <View
      width="100%"
      $gtMd={{ width: "50%" }} // Greater than medium breakpoint
    >
      {media.gtMd ? <DesktopView /> : <MobileView />}
    </View>
  );
}
```

### Theme Switching (Cross-Platform)

```tsx
import { Theme } from "tamagui";

function ThemedComponent() {
  return (
    <Theme name="dark">
      <View backgroundColor="$background">
        <Text color="$color">Dark theme content</Text>
      </View>
    </Theme>
  );
}
```

## Component Library Guidelines

### Production-Ready Component Library

We have **8 hardened component families** in `packages/ui` (~1,500 lines of production code):

1. **Button** - Custom styled Button with `butterVariant` prop (`primary` | `secondary`) + numeric size tokens ($1-$16)
2. **Typography** - Text, Heading (h1-h6), Label with fontSize tokens
3. **Layout** - Row, Column, Container, Spacer for flexible layouts
4. **Card** - 4 variants (elevated, outlined, filled, ghost) with compound components
5. **Input** - 3 sizes with validation states (error, success, disabled)
6. **Badge** - 8 variants for status indicators
7. **Spinner** - Loading indicators with size variants
8. **Image & ScrollView** - Enhanced re-exports with proper typing

### Critical Component Usage Patterns

#### ✅ **ALWAYS Use butterVariant for Styled Buttons**

Our custom Button component uses `butterVariant` prop for brand-consistent styling with proper shadows and hover states.

```tsx
// ✅ CORRECT - Use butterVariant for styled buttons
import { Button } from "@buttergolf/ui";

// Primary button (Spiced Clementine with drop shadow)
<Button butterVariant="primary" size="$5">
  Sell now
</Button>

// Secondary button (Light grey with drop shadow)
<Button butterVariant="secondary" size="$4">
  Shop now
</Button>

// Ghost/tab buttons use chromeless (no butterVariant needed)
<Button chromeless size="$4">
  Cancel
</Button>

// ❌ WRONG - Don't use inline backgroundColor/color for styled buttons
<Button backgroundColor="$primary" color="$textInverse" size="$5">
  Submit
</Button>

// ❌ WRONG - Never create manual HTML buttons with inline styles
<button
  style={{
    backgroundColor: "#F45314",
    color: "#FFFAD2",
    borderRadius: "32px",
    padding: "14px 40px",
  }}
>
  View all listings
</button>

// ❌ WRONG - Don't use non-existent variants
<Button size="lg" tone="primary">
  Submit
</Button>
```

**Why butterVariant?**

- **Brand consistency** - Enforces Figma-designed button styles
- **Cross-platform shadows** - Both variants get unified drop shadow, mobile gracefully degrades
- **Built-in states** - Proper hover, press, and focus styles included
- **Type-safe** - Only `primary` | `secondary` allowed
- **Compiler-optimized** - Uses Tamagui `styled()` for performance
- **Avoids conflicts** - Named `butterVariant` to avoid Tamagui's internal `variant` prop

**When NOT to use butterVariant:**

- Tab/filter buttons → Use `chromeless`
- Icon-only buttons → Use `chromeless` with padding overrides
- Custom one-off styling → Direct props are acceptable but avoid if possible

#### ✅ **ALWAYS Use Semantic Color Tokens in App Code**

**🎨 IMPORTANT: Use semantic tokens for theme support and maintainability**

Semantic tokens automatically adapt to theme changes and make intent clear. **Prefer these in all app code.**

```tsx
// ✅ CORRECT - Use semantic tokens in app code (PREFERRED)
<Button backgroundColor="$primary" color="$textInverse">Submit</Button>
<Text color="$text">Primary text</Text>
<Text color="$textSecondary">Secondary text</Text>
<Text color="$textMuted">Helper text</Text>
<View borderColor="$border" backgroundColor="$background">Content</View>

// ⚠️ USE SPARINGLY - Brand tokens only in component libraries or theme-independent contexts
<Text color="$ironstone">Always dark gray (no theme switching)</Text>
<View backgroundColor="$vanillaCream">Always cream (no theme switching)</View>

// ❌ WRONG - Never use numbered colors or raw hex values
<Button backgroundColor="#F45314">Submit</Button>    // No theming, use $primary
<Text color="$color">Text</Text>                     // Old token name
<View borderColor="$borderColor">Content</View>      // Old token name
<Text color="$color11">Text</Text>                   // Numbered color (deprecated)
```

**Token Usage Guidelines:**

| Context                            | Use This                                      | Not This                                     | Reason                                 |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| **App code (99% of cases)**        | `$primary`, `$text`, `$background`, `$border` | `$spicedClementine`, `$ironstone`, `#F45314` | Semantic tokens enable theme switching |
| **Component library defaults**     | `$ironstone`, `$vanillaCream`                 | Direct hex values                            | Brand tokens are the foundation        |
| **When you need a specific color** | `$spicedClementine` (sparingly)               | `#F45314`                                    | Token enables tooling & consistency    |

**Brand Color Token Reference (for component library use):**

| Token               | Hex     | Use Case                        |
| ------------------- | ------- | ------------------------------- |
| `$ironstone`        | #323232 | Primary dark text, headings     |
| `$slateSmoke`       | #545454 | Secondary text, muted content   |
| `$cloudMist`        | #EDEDED | Borders, dividers, subtle lines |
| `$vanillaCream`     | #FFFAD2 | Light backgrounds, surfaces     |
| `$spicedClementine` | #F45314 | Primary brand color, CTAs       |
| `$burntOlive`       | #3E3B2C | Dark accents, secondary brand   |
| `$lemonHaze`        | #EDECC3 | Subtle accents, tertiary        |
| `$pureWhite`        | #FFFFFF | Pure white for contrast         |

**When to use which:**

- **Semantic tokens** (`$text`, `$background`, `$primary`, etc.) - **USE IN 99% OF APP CODE** for automatic theme switching and maintainability
- **Brand tokens** (`$ironstone`, `$vanillaCream`, `$spicedClementine`, etc.) - Use ONLY when defining component defaults in `packages/ui` or when you need a specific brand color that absolutely won't change with themes

#### ✅ **ALWAYS Use Component Variants (When They Exist)**

```tsx
// ✅ CORRECT - Use standard Tamagui patterns
<Button size="$5" backgroundColor="$primary" color="$textInverse">Submit</Button>
<Text fontSize="$4" fontWeight="600">Helper text</Text>
<Card variant="elevated" padding="lg">Content</Card>
<Input size="md" error fullWidth />

// ❌ WRONG - Don't use outdated custom variants
<Button size="lg" tone="primary">Submit</Button>
```

#### ✅ **ALWAYS Use Compound Components for Cards**

```tsx
// ✅ CORRECT - Use compound components
<Card variant="elevated">
  <Card.Header>
    <Heading level={3}>Title</Heading>
  </Card.Header>
  <Card.Body>
    <Text>Content</Text>
  </Card.Body>
  <Card.Footer align="right">
    <Button>Action</Button>
  </Card.Footer>
</Card>

// ❌ WRONG - Don't use old CardHeader/CardFooter imports
<Card>
  <CardHeader padding="$4">Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

#### ✅ **ALWAYS Use Layout Components**

```tsx
// ✅ CORRECT - Use semantic layout components with native Tamagui props
<Column gap="$lg">
  <Heading level={2}>Title</Heading>
  <Text>Description</Text>
  <Button>Action</Button>
</Column>

<Row gap="$md" alignItems="center" justifyContent="space-between">
  <Text>Left content</Text>
  <Button>Right action</Button>
</Row>

<Container size="lg" paddingHorizontal="$md">
  <Text>Constrained content</Text>
</Container>

// ❌ WRONG - Don't use raw YStack/XStack when semantic components exist
<YStack gap="$6" alignItems="stretch">
  <Text marginBottom="$4">Title</Text>
  <Text>Content</Text>
</YStack>
```

**Note**: Row and Column are thin wrappers over XStack/YStack - they preserve ALL native Tamagui props like `alignItems`, `justifyContent`, `flexWrap`, etc. Use these native props directly.

#### ⚠️ **CRITICAL: Understanding 'size' - Two Different Meanings**

**🚨 THIS IS THE MOST COMMON ERROR - READ CAREFULLY 🚨**

The word "size" has **TWO COMPLETELY DIFFERENT meanings** in our design system:

### 1️⃣ Font Size Tokens (for Text/Typography)

**THE CRITICAL RULE: Text/SizableText/Paragraph components use `size` prop with NUMERIC tokens ($1-$16)**

Tamagui's **official SizableText and Paragraph components** use a standard **numbered font size scale** (`$1` through `$16`). The `size` prop is the standard Tamagui pattern for typography sizing.

- ✅ **CORRECT - Use `size` with numbered tokens on Text/SizableText/Paragraph**:

  ```tsx
  <Text size="$4">Small (14px)</Text>
  <Text size="$5">Medium (15px) - DEFAULT</Text>
  <Text size="$6">Large (16px)</Text>
  <Text size="$7">XL (18px)</Text>
  <Text size="$8">2XL (20px)</Text>
  <Paragraph size="$5">Body text with default size</Paragraph>
  ```

- ❌ **WRONG - NEVER use fontSize prop, NEVER use named sizes**:
  ```tsx
  <Text fontSize="$5">Wrong!</Text>       // Use size, not fontSize
  <Text size="md">Wrong!</Text>           // Named sizes don't exist
  <Text size="$md">Wrong!</Text>          // $md is spacing, not font size
  ```

### 2️⃣ Component Size Variants (for UI Components)

**For Button, Input, Badge, Spinner - use NUMERIC `size` tokens ($1-$16)**

These components also use numeric `size` tokens that control **geometric dimensions** (height, padding, width).

- ✅ **CORRECT - Use numeric size tokens on UI components**:

  ```tsx
  <Button size="$4">Click me</Button>     // Controls height and padding
  <Input size="$5" />                     // Controls height and padding
  <Badge size="$3">NEW</Badge>            // Controls min-height
  <Spinner size="$4" />                   // Controls width/height
  ```

- ❌ **WRONG - Don't use named sizes**:
  ```tsx
  <Button size="md">Wrong!</Button>       // Use numeric tokens like $4
  <Input size="lg">Wrong!</Input>         // Use numeric tokens like $5
  ```

**Summary Table:**

| Component Type                    | Prop to Use | Valid Values | Controls                    | Example              |
| --------------------------------- | ----------- | ------------ | --------------------------- | -------------------- |
| **Text, SizableText, Paragraph**  | `size`      | `$1` - `$16` | Font size & line height     | `<Text size="$5">`   |
| **Button, Input, Badge, Spinner** | `size`      | `$1` - `$16` | Height, padding, dimensions | `<Button size="$4">` |

**Why This Works:**

Tamagui's design system uses numeric tokens for all sizing. Our config defines font sizing with keys `1` through `16`, mapping to pixel values. When you use `size="$5"`, Tamagui looks up the appropriate size from your theme configuration.

**Font Size Token Reference:**

| Token    | Size (px) | Use Case                |
| -------- | --------- | ----------------------- |
| `$1`     | 11        | Legal text, tiny labels |
| `$2`     | 12        | Captions, metadata      |
| `$3`     | 13        | Small labels            |
| `$4`     | 14        | Body small, helper text |
| **`$5`** | **15**    | **DEFAULT - Body text** |
| `$6`     | 16        | Large body text         |
| `$7`     | 18        | Subheadings             |
| `$8`     | 20        | Large subheadings       |
| `$9`     | 22        | Small headings          |
| `$10`    | 24        | Medium headings         |
| `$11`    | 28        | Large headings          |
| `$12`    | 32        | XL headings             |
| `$13`+   | 40+       | Hero text               |

**Common Patterns:**

```tsx
// Body text (most common)
<Text size="$5">Regular paragraph text</Text>
<Paragraph size="$5">Paragraph with default theme color</Paragraph>

// Helper text / captions
<Text size="$4" color="$textSecondary">Helper text</Text>

// Subheadings
<Text size="$7" fontWeight="600">Section title</Text>

// Large display text
<Text size="$11" fontWeight="700">Hero headline</Text>

// Buttons with consistent sizing
<Button size="$4">Small button</Button>
<Button size="$5">Medium button</Button>
<Button size="$6">Large button</Button>
```

#### ✅ **Using Colors in Text Components**

```tsx
// ✅ CORRECT - Use direct token references
<Text color="$text">Default text</Text>
<Text color="$textSecondary">Secondary text</Text>
<Text color="$textTertiary">Tertiary text</Text>
<Text color="$textMuted">Muted text</Text>
<Text color="$textInverse">Inverse text (for dark backgrounds)</Text>
<Text color="$primary">Primary colored</Text>
<Text color="$success">Success message</Text>
<Text color="$error">Error message</Text>
<Text color="$warning">Warning message</Text>

// ❌ WRONG - Don't use old token names
<Text color="$color">Text</Text>           // Old token
<Text color="$color11">Text</Text>         // Numbered color
```

**Important**: The Text component does NOT have color variants. Use direct token references with the `$` prefix for all color styling.

### Understanding Variants vs Direct Token Props

**CRITICAL DISTINCTION:** Tamagui has two ways to use design tokens:

#### 1️⃣ **Custom Variants** (For Custom Component APIs Only)

Variants are **named options** defined in `styled()` components. They use **plain strings WITHOUT `$`** that map to tokens internally.

```tsx
// ✅ CORRECT - Using custom variants (NO $ prefix) in custom components
<Card padding="lg">         // "lg" is a variant option we defined
<Container size="lg">       // Custom variant for max-width
<Badge variant="primary">   // Custom variant for visual style

// Defined in styled() like this:
const Card = styled(View, {
  variants: {
    padding: {
      lg: { padding: '$lg' },
    }
  }
})
```

**⚠️ IMPORTANT:** Never create variants for props that **already exist on the base component** (like `gap`, `padding`, `margin`, `alignItems`, `justifyContent`). This causes TypeScript intersection type errors!

**When to use:** Component-specific props that have a fixed set of semantic options (card padding, container size, badge variant).

#### 2️⃣ **Direct Token Props** (For Standard Tamagui Components & Styling)

Direct props accept token values **WITH `$`** for ad-hoc styling on any Tamagui component. This is how Tamagui's built-in components work.

```tsx
// ✅ CORRECT - Using direct token props (WITH $ prefix)
<Row gap="$xl">                         // Use tokens directly - gap is native to XStack
<Column gap="$lg">                      // Use tokens directly - gap is native to YStack
<View padding="$md">                    // Direct token reference
<YStack gap="$4">                       // Direct token reference
<Text size="$5" color="$textMuted">     // Direct token references
<Button size="$4" backgroundColor="$primary"> // Standard Tamagui Button with direct props
<View backgroundColor="$surface">       // Direct token reference
<View borderRadius="$lg">               // Direct token reference
```

**When to use:** Layout spacing (gap, padding, margin), geometric properties (width, height, borderRadius), colors, Button styling, and any prop that exists natively on the base component.

### Real-World Examples

```tsx
// ✅ CORRECT - Mixed usage based on context

// Layout components use DIRECT TOKENS for native props
<Row gap="$md" alignItems="center">     // gap="$md" - direct token (native prop)
  <Column gap="$lg">                     // gap="$lg" - direct token (native prop)
    <Text color="$textMuted" size="$4">  // color & size - both direct tokens
      Helper text
    </Text>
  </Column>
</Row>

// Primitives use direct tokens (flexible, ad-hoc)
<View padding="$4" backgroundColor="$surface" borderRadius="$md">
  <YStack gap="$3">
    <Text size="$4" color="$text">Direct token usage</Text>
  </YStack>
</View>

// Standard Tamagui Button uses direct props
<Button size="$5" backgroundColor="$primary" color="$textInverse">
  Submit
</Button>

// Custom components use their defined variants
<Card variant="elevated" padding="lg">  // variant/padding - custom variants
  <Card.Body>
    <Text>Content</Text>
  </Card.Body>
</Card>
```

### Token Usage Cheat Sheet

```tsx
// ✅ CORRECT - Direct tokens (WITH $ prefix) for layout components
<Row gap="$xl">                   // Row/Column use DIRECT tokens (gap is native to XStack)
<Column gap="$lg">                // Don't use variants for native props!
<YStack gap="$4">                 // Direct prop on primitive
<View padding="$md">              // Direct prop on primitive
<Text size="$5" color="$textMuted"> // Direct props (not using size variant)
<View borderRadius="$lg">         // Direct geometric prop
<View backgroundColor="$surface"> // Direct color token

// ✅ CORRECT - Custom variants (NO $ prefix) for component-specific props
<Card padding="lg">               // Card component variant (custom, not native padding)
<Container size="lg">             // Container size variant

// ❌ WRONG - Creating variants for native props
<Row gap="md">                    // ❌ gap exists natively, use gap="$md"
<Column gap="lg">                 // ❌ gap exists natively, use gap="$lg"

// ❌ WRONG - Mixing them up
<View padding="md">               // ❌ Missing $ for direct prop

// ❌ WRONG - Using specific/old tokens
<View backgroundColor="$spicedClementine"> // ❌ Too specific, use semantic
<Text color="$color">             // ❌ Old token name
<View borderColor="$borderColor"> // ❌ Old token name
```

#### ✅ **Web-Only CSS Properties Pattern**

For web-only CSS properties that React Native doesn't support (like `position: sticky/fixed`, `overflow: auto`), use the `style` prop:

```tsx
// ✅ CORRECT - Use style prop for web-only CSS properties
<Column style={{ position: "sticky" }} top={0} zIndex={100}>
<Row style={{ overflow: "auto" }}>

// ❌ WRONG - Don't use escape hatches
<Column {...{ position: "sticky" as any }} top={0}>

// Why: The style prop is the standard React way to apply inline styles.
// These files are web-only and will never run on React Native.
```

### Creating New Components

1. **Add to `packages/ui/src/components/`**:

```tsx
// packages/ui/src/components/MyComponent.tsx
import { styled, GetProps, View } from "tamagui";

export const MyComponent = styled(View, {
  name: "MyComponent", // Required for compiler optimization

  // Base styles using semantic tokens
  backgroundColor: "$surface",
  borderRadius: "$md",
  borderWidth: 1,
  borderColor: "$border",
  padding: "$md",

  // Interactive states
  hoverStyle: {
    borderColor: "$borderHover",
  },

  pressStyle: {
    backgroundColor: "$backgroundPress",
  },

  focusStyle: {
    borderColor: "$borderFocus",
    borderWidth: 2,
  },

  variants: {
    size: {
      sm: { padding: "$sm" },
      md: { padding: "$md" },
      lg: { padding: "$lg" },
    },

    tone: {
      primary: {
        borderColor: "$primary",
        backgroundColor: "$primaryLight",
      },
      error: {
        borderColor: "$error",
        backgroundColor: "$errorLight",
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

export type MyComponentProps = GetProps<typeof MyComponent>;
```

2. **Export from `packages/ui/src/index.ts`**:

```tsx
export { MyComponent } from "./components/MyComponent";
export type { MyComponentProps } from "./components/MyComponent";
```

3. **Document in `packages/ui/README.md`** with usage examples

### Component API Reference

#### Understanding Component Size Props

**CRITICAL: ALL components now use standard Tamagui numeric size tokens**

1. **Button** - `size` uses **numeric tokens** ($1-$16):

   ```tsx
   <Button size="$4">Standard button</Button>  // ✅ Numeric tokens control font size
   <Button size="$5" paddingHorizontal="$5" paddingVertical="$3">Larger</Button>
   ```

2. **Text, Paragraph** - `size` uses **numeric tokens** ($1-$16):

   ```tsx
   <Text size="$5">Body text</Text>  // ✅ Use numeric tokens ($1-$16)
   <Paragraph size="$5">Paragraph with theme colors</Paragraph>
   ```

3. **Input, Badge, Spinner** - `size` variant controls **HEIGHT and padding** (custom sizing):

   ```tsx
   <Input size="sm" />   // ✅ Custom variants for these components
   <Badge size="md" />   // ✅ sm/md/lg controls height
   <Spinner size="lg" /> // ✅ Geometric sizing
   ```

4. **Heading** - NO `size` variant, use **`level` prop** (semantic HTML):
   ```tsx
   <Heading level={2}>Title</Heading>  // ✅ level controls h1-h6 + font size
   <Heading size="$8">Override size</Heading>  // ⚠️ Can override with size prop
   ```

#### Button

**CRITICAL: We use STANDARD Tamagui Button with numeric size tokens and direct prop styling. NO custom variants.**

```tsx
<Button
  size="$4" // Standard Tamagui numeric size tokens ($1-$16)
  backgroundColor="$primary" // Direct color prop
  color="$textInverse" // Direct text color
  paddingHorizontal="$4" // Direct padding
  paddingVertical="$3" // Direct padding
  borderRadius={24} // Direct styling
  width="100%" // Full width if needed
  disabled={boolean} // Disabled state
  chromeless={boolean} // Chromeless/ghost style (use instead of tone="ghost")
>
  Button Text
</Button>
```

**Standard Tamagui Button Patterns:**

```tsx
// Primary button (pill-shaped)
<Button size="$5" backgroundColor="$primary" color="$textInverse" paddingHorizontal="$5" paddingVertical="$3" borderRadius="$full">
  Primary Action
</Button>

// Outline button (pill-shaped)
<Button size="$4" backgroundColor="transparent" color="$primary" borderWidth={2} borderColor="$primary" paddingHorizontal="$4" paddingVertical="$3" borderRadius="$full">
  Secondary Action
</Button>

// Ghost/chromeless button
<Button size="$4" chromeless>
  Cancel
</Button>

// Success button (pill-shaped)
<Button size="$5" backgroundColor="$success" color="$textInverse" paddingHorizontal="$5" paddingVertical="$3" borderRadius="$full">
  Confirm
</Button>
```

**Important**: Button uses standard Tamagui size tokens ($1-$16) which control font size. Use paddingHorizontal/paddingVertical to control button dimensions.

#### Text

```tsx
<Text
  size="$1" | "$2" | "$3" | "$4" | "$5" | ... "$16" // Use numeric tokens (default: $5)
  fontWeight="400" | "500" | "600" | "700" // Font weight (or use weight prop)
  weight="normal | medium | semibold | bold" // Semantic weight variant
  textAlign="left | center | right" // Text alignment
  truncate={boolean} // Truncate with ellipsis
  color="$token" // Use direct token references (e.g., "$text", "$textSecondary", "$primary")
>
  Text content
</Text>
```

**CRITICAL**: Text uses standard Tamagui `size` prop with numeric tokens (`$1` through `$16`). This is the STANDARD way.

**Note**: Text does NOT have color variants. Always use direct token references like `color="$textMuted"` or `color="$primary"`.

#### Heading

```tsx
<Heading
  level={1 | 2 | 3 | 4 | 5 | 6} // Heading level (h1-h6)
  align="left | center | right" // Text alignment
  color="$token" // Use direct token references (e.g., "$text", "$primary")
>
  Heading text
</Heading>
```

**Note**: Heading does NOT have color variants. Use direct token references for colors.

#### Row (Horizontal Layout)

```tsx
<Row
  gap="$xs | $sm | $md | $lg | $xl" // Gap between children (use tokens)
  alignItems="flex-start | center | flex-end | stretch | baseline" // Vertical alignment
  justifyContent="flex-start | center | flex-end | space-between | space-around | space-evenly" // Horizontal alignment
  flexWrap="wrap | nowrap" // Allow wrapping
  width="100%" // Full width (or any other value)
>
  {children}
</Row>
```

**Note**: Row is a thin wrapper over XStack - use native React Native flexbox props, not custom variants.

#### Column (Vertical Layout)

```tsx
<Column
  gap="$xs | $sm | $md | $lg | $xl" // Gap between children (use tokens)
  alignItems="flex-start | center | flex-end | stretch" // Horizontal alignment
  justifyContent="flex-start | center | flex-end | space-between | space-around | space-evenly" // Vertical alignment
  width="100%" // Full width
  height="100%" // Full height
>
  {children}
</Column>
```

**Note**: Column is a thin wrapper over YStack - use native React Native flexbox props, not custom variants.

#### Card

```tsx
<Card
  variant="elevated | outlined | filled | ghost" // Card style (default: elevated)
  padding="none | xs | sm | md | lg | xl" // Padding (default: md)
  interactive={boolean} // Adds hover/press effects
  fullWidth={boolean} // Full width
>
  <Card.Header padding="md" noBorder={boolean}>
    Header content
  </Card.Header>

  <Card.Body padding="md">Main content</Card.Body>

  <Card.Footer padding="md" align="left | center | right" noBorder={boolean}>
    Footer content
  </Card.Footer>
</Card>
```

#### Input

```tsx
<Input
  size="sm | md | lg" // Size variant (default: md)
  error={boolean} // Error state
  success={boolean} // Success state
  disabled={boolean} // Disabled state
  fullWidth={boolean} // Full width
  placeholder="..." // Placeholder text
/>
```

#### Badge

```tsx
<Badge
  variant="primary | secondary | success | error | warning | info | neutral | outline"
  size="sm | md | lg" // Size variant (default: md)
  dot={boolean} // Minimal dot indicator
>
  Badge text
</Badge>
```

#### Container

```tsx
<Container
  size="sm | md | lg | xl | 2xl | full" // Max width (default: lg)
  padding="none | xs | sm | md | lg | xl" // Horizontal padding (default: md)
  center={boolean} // Center align content
>
  {children}
</Container>
```

### Compound Components Pattern

For complex components with sub-components:

```tsx
// packages/ui/src/components/Accordion.tsx
import { createStyledContext, styled, YStack } from "tamagui";

// Note: 'as any' here is required by Tamagui's createStyledContext API
// This is the ONLY acceptable use case - it's part of Tamagui's typed context system
const AccordionContext = createStyledContext({
  size: "$md" as any,
});

export const AccordionFrame = styled(YStack, {
  context: AccordionContext,
});

export const AccordionItem = styled(YStack, {
  context: AccordionContext,
  // Uses context.size
});

// Main export
export const Accordion = AccordionFrame as typeof AccordionFrame & {
  Item: typeof AccordionItem;
};

Accordion.Item = AccordionItem;
```

## TypeScript Configuration

### Path Mappings

All path mappings are centralized in `/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@buttergolf/ui": ["packages/ui/src"],
      "@buttergolf/*": ["packages/*/src"]
    }
  }
}
```

Each app extends this base configuration.

### Type Checking

- Run `pnpm typecheck` before committing
- Strict mode is enabled across the workspace
- No implicit any, unused locals, or unused parameters allowed

## Styling Conventions

### Tamagui Styling Patterns

1. **Inline Styles with Tokens**:

```tsx
<View
  backgroundColor="$blue10"
  padding="$4"
  borderRadius="$4"
  hoverStyle={{
    backgroundColor: "$blue11",
  }}
/>
```

2. **Media Queries**:

```tsx
<View
  width={200}
  $sm={{ width: 300 }} // Small screens
  $md={{ width: 400 }} // Medium screens
  $lg={{ width: 500 }} // Large screens
/>
```

3. **Pseudo States**:

```tsx
<Button
  backgroundColor="$blue10"
  hoverStyle={{ backgroundColor: "$blue11" }}
  pressStyle={{ backgroundColor: "$blue9" }}
  focusStyle={{ borderColor: "$blue8" }}
/>
```

4. **Group Styling**:

```tsx
<View group="card">
  <Text $group-card-hover={{ color: "$blue10" }}>Hover the parent to see me change</Text>
</View>
```

### Tailwind CSS (Web Only)

Used in Next.js for web-specific styling when Tamagui doesn't fit:

```tsx
<div className="container mx-auto px-4">{/* Tailwind classes */}</div>
```

## Build & Compilation

### Turborepo Configuration

Located at `/turbo.json`:

- Defines task pipelines
- Manages build outputs: `.next`, `.expo`
- Caches build artifacts
- Persistent tasks: `dev`, `start`

### Build Outputs

- **Web**: `.next/` (gitignored)
- **Mobile**: `.expo/` (gitignored)
- **Tamagui**: `.tamagui/` (gitignored) - generated component builds

### Performance Optimization

- Tamagui compiler extracts styles to CSS at build time
- Metro bundler configured for monorepo with workspace watching
- Next.js transpiles packages for web compatibility

## Common Workflows

### Adding a New Feature

1. Create cross-platform UI components in `packages/ui`
2. Use components in both `apps/web` and `apps/mobile`
3. Test on both platforms before committing
4. Run type checking: `pnpm typecheck`

### Adding Dependencies

```bash
# Root workspace
pnpm add <package> -w

# Specific app or package
pnpm add <package> --filter @buttergolf/ui
pnpm add <package> --filter web
pnpm add <package> --filter mobile
```

### Updating Dependencies

```bash
# Update all Tamagui packages (keep versions aligned)
pnpm up '@tamagui/*@latest' -r

# Update all dependencies
pnpm up -r
```

## Debugging

### TypeScript Errors

- Check path mappings in `tsconfig.base.json`
- Ensure all `@buttergolf/*` packages are properly defined
- Verify peer dependencies are satisfied

### Module Resolution Issues

- Clear Metro bundler cache: `pnpm dev:mobile --clear`
- Clear Next.js cache: `rm -rf apps/web/.next`
- Reinstall dependencies: `pnpm clean-install`

### Tamagui Specific

- Verify Tamagui config is exported correctly from `tamagui.config.ts`
- Check that all apps have `TamaguiProvider` at the root
- Ensure `@tamagui/babel-plugin` is in babel config (mobile)
- Verify `transpilePackages` includes all Tamagui packages (web)

## Database (Prisma)

### Package: `@buttergolf/db`

The database package uses Prisma 6.x as the ORM with PostgreSQL.

**Key Files**:

- `packages/db/prisma/schema.prisma` - Database schema
- `packages/db/src/index.ts` - Prisma Client singleton export
- `packages/db/prisma/seed.ts` - Database seeding script
- `packages/db/.env` - Database connection string

**Schema Models** (example - customize for your app):

- `User` - User accounts
- `Round` - Golf rounds played
- `Hole` - Individual hole scores

### Using the Database in Apps

1. **Add to dependencies**:

```json
{
  "dependencies": {
    "@buttergolf/db": "workspace:*"
  }
}
```

2. **Import and use**:

```typescript
import { prisma } from "@buttergolf/db";

// Query data
const users = await prisma.user.findMany();

// Create data
const round = await prisma.round.create({
  data: {
    userId: user.id,
    courseName: "Pebble Beach",
    score: 72,
  },
});
```

### Database Workflow

**🚨 CRITICAL: ALWAYS USE MIGRATIONS - NO EXCEPTIONS 🚨**

❌ **NEVER EVER use `pnpm db:push` for schema changes** - This creates database drift and causes migration conflicts that require data loss to resolve.

❌ **DO NOT use `db:push` even when you see drift errors** - Use the proper workflow below instead.

✅ **ALWAYS use `pnpm db:migrate:dev --name descriptive-name`** - This creates proper migration files that track schema changes and prevent drift.

**THE ONLY CORRECT WORKFLOW:**

1. **Modify schema**: Edit `packages/db/prisma/schema.prisma`
2. **Create migration**: `cd packages/db && pnpm prisma migrate dev --name descriptive-change-name`
   - This creates a migration file in `prisma/migrations/`
   - This applies the migration to your database
   - This keeps your migration history in sync with your database
   - This automatically runs `prisma generate`
3. **Seed data** (if needed): `pnpm db:seed`

**IF YOU ENCOUNTER DRIFT ERRORS:**

If you see "Drift detected: Your database schema is not in sync with your migration history":

**SOLUTION: Reset and reseed (this is the CORRECT approach)**

```bash
cd packages/db
pnpm prisma migrate reset --force  # Drops DB, reapplies all migrations
cd ../..
pnpm db:seed  # Reseeds all data
```

This is the ONLY proper way to resolve drift. It ensures migration history is clean and the database can be deployed to production safely.

**Why This Matters:**

- `db:push` applies changes directly without creating migration files
- This causes "drift" where your database has columns/tables that aren't in migrations
- When you try to create a new migration later, Prisma detects drift and you MUST reset
- Migrations create a proper history and allow safe deployments to production
- **We have made this mistake 7+ times - NEVER DO IT AGAIN**

**NO EXCEPTIONS:** There is no "quick fix" scenario where db:push is acceptable. Always use migrations.

**Understanding Prisma Commands:**

- `prisma migrate dev` - ✅ THE ONLY COMMAND YOU SHOULD USE - Creates migration files, version-controlled, production-safe
- `prisma migrate reset --force` - ✅ CORRECT way to resolve drift - Drops database, reapplies all migrations, reseeds data
- `prisma db push` - ❌ FORBIDDEN - Never use this, it causes drift
- `prisma migrate resolve` - ❌ DO NOT USE - Does not actually fix drift, makes it worse

### Database Setup Options

**Local PostgreSQL with Docker**:

```bash
docker run --name buttergolf-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=buttergolf \
  -p 5432:5432 \
  -d postgres:16
```

**Prisma Postgres (Cloud)**:

```bash
pnpm --filter @buttergolf/db prisma-platform-login
pnpm --filter @buttergolf/db prisma-postgres-create-database --name buttergolf
```

**Other providers**: Supabase, Neon, Railway, etc. - just update `DATABASE_URL` in `.env`

### Important Notes

- The Prisma Client is generated to `packages/db/generated/client` (custom output for pnpm monorepo compatibility)
- Always run `pnpm db:generate` after schema changes
- Use `pnpm db:studio` to view/edit data in a GUI
- The `generated/` folder is in `.gitignore`
- Each app/package that uses the database imports the singleton client from `@buttergolf/db`

### 🚨 CRITICAL: Prisma Import Rules (pnpm Monorepo)

**NEVER import directly from `@prisma/client`** - This causes "Cannot find module '.prisma/client/default'" build errors in pnpm monorepos.

```typescript
// ❌ WRONG - NEVER DO THIS - Causes build failures
import { PrismaClient } from "@prisma/client";
import { ProductCondition } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ✅ CORRECT - ALWAYS import from @buttergolf/db
import { prisma } from "@buttergolf/db";
import { ProductCondition } from "@buttergolf/db";
import type { Prisma } from "@buttergolf/db";
```

**Why This Matters:**

- pnpm uses symlinks and strict module resolution
- `@prisma/client` looks for `.prisma/client/default` which doesn't exist at expected paths in monorepos
- Our custom Prisma output (`packages/db/generated/client`) fixes this but ONLY when importing via `@buttergolf/db`
- Direct `@prisma/client` imports bypass this fix and cause build failures

**What to Export from @buttergolf/db:**

- `prisma` - The singleton PrismaClient instance
- `Prisma` - The Prisma namespace for types like `Prisma.ProductWhereInput`
- All enums: `ProductCondition`, `ClubKind`, `OrderStatus`, `OfferStatus`, `ShipmentStatus`

**If you see "Cannot find module '.prisma/client/default'":**

1. Search codebase for `from '@prisma/client'` or `from "@prisma/client"`
2. Change ALL imports to use `@buttergolf/db` instead
3. If needed, add missing exports to `packages/db/src/index.ts`

## Authentication (Clerk)

We use Clerk for user auth on both platforms. The web app uses `@clerk/nextjs`; the Expo app uses `@clerk/clerk-expo`. User records are synchronized to our database via a Clerk webhook and the `User` model includes a `clerkId` to map identities.

### Packages

- Web: `@clerk/nextjs`, `svix` (webhook signature verification)
- Mobile: `@clerk/clerk-expo`, `expo-auth-session`, `expo-secure-store`

### Environment variables

Place values in your shell or in environment files (see `.env.example` and `docs/AUTH_SETUP_CLERK.md`).

- Web (Next.js)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET` (for the user sync webhook)
- Mobile (Expo)
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

Important: Only publishable keys may be exposed to the client (`NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`). Keep secret keys server-only.

### Web wiring (Next.js App Router)

- Provider: `apps/web/src/app/NextTamaguiProvider.tsx`
  - Wraps the app in `<ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>` and then our Tamagui provider.
- Header: `apps/web/src/app/_components/AuthHeader.tsx`
  - Shows SignedOut `SignInButton` and SignedIn `UserButton`, plus simple navigation.
- Auth routes:
  - Sign-in: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
  - Sign-up: `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`
- Protecting routes (server components):
  - Example: `apps/web/src/app/rounds/page.tsx`
  - Use `const { userId } = await auth(); if (!userId) redirect('/sign-in')`
- SSG vs SSR with Clerk:
  - The root layout/page are marked `export const dynamic = 'force-dynamic'` to avoid needing the Clerk publishable key at build time. If you provide build-time env vars for Clerk, you can remove the flag on a page-by-page basis to re-enable SSG.

### Webhook (user sync to Prisma)

- Route: `apps/web/src/app/api/clerk/webhook/route.ts`
- Verifies Svix signature using `svix` lib and upserts users into Prisma:
  - `where: { clerkId }`
  - Sets `email`, `name`, `imageUrl`
- Events: `user.created`, `user.updated`
- Prisma schema has `User.clerkId @unique` (see `packages/db/prisma/schema.prisma`).

### Mobile wiring (Expo)

- Provider: `apps/mobile/App.tsx`
  - Wraps the app in `<ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY} tokenCache={SecureStore}>`
  - Uses `<SignedIn>` to render navigation and `<SignedOut>` to render a simple OAuth screen.
- OAuth sign-in (dev friendly):
  - Uses `useOAuth({ strategy: 'oauth_google' })` and, on iOS, `oauth_apple`.
  - Note: `useOAuth` is being deprecated upstream; the code is annotated and can be migrated later to the new API when convenient.
- Deep linking scheme:
  - `apps/mobile/app.json` includes `"scheme": "buttergolf"`.
  - With the Expo Auth Session proxy (default in dev), no extra dashboard redirect URL is required.

### Local development flow

1. Set env variables (see `.env.example` and `docs/AUTH_SETUP_CLERK.md`).
2. Start web: `pnpm dev:web` and visit `/sign-in` or use the header button.
3. Start mobile: `pnpm dev:mobile` and sign in with Google/Apple.
4. (Optional) Configure the Clerk webhook to `http://localhost:3000/api/clerk/webhook` with events `user.created` and `user.updated` to sync users into Prisma.

### Notes and patterns

- Use server checks with `auth()` and `redirect()` in App Router pages to protect content.
- Keep the DB source of truth synced by webhook; do not create new `PrismaClient` instances outside `@buttergolf/db`.
- If you hit build-time errors about "Missing publishableKey", either set the build-time env vars or mark the page/layout as `dynamic` as above.
- When adding new protected routes, follow the `rounds/page.tsx` pattern.

For a detailed setup, see `docs/AUTH_SETUP_CLERK.md`.

## Web Application Header Structure

### ButterHeader Component

The web application uses a unified header with the ButterGolf brand identity.

**Location**: `apps/web/src/app/_components/header/ButterHeader.tsx`

**Key Features**:

- Single header bar with Spiced Clementine background (`$primary` - #F45314)
- Fixed positioning at top (below optional TrustBar)
- Height: ~80px (reduced from previous 180px three-layer header)
- Sticky with shadow effect on scroll
- Responsive with mobile-first design

**Layout Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]  HOME  FEATURES  ABOUT  CONTACT    [Search 🔍]  [❤️][🛒][👤] │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

1. **Logo** (Left):
   - Uses `logo-white.png` (50px height) on orange background
   - Links to homepage
   - Always visible

2. **Center Navigation** (Desktop only, hidden on mobile):
   - HOME | FEATURES | ABOUT US | CONTACT US
   - Urbanist Medium (500 weight), 14px
   - White text with underline on hover
   - Hidden below `$lg` breakpoint

3. **Search Bar** (Right side):
   - Desktop: Semi-transparent white pill shape (250px width)
   - Mobile: Search icon only (expands to full bar in mobile menu)
   - Background: `rgba(255, 255, 255, 0.2)` with backdrop blur
   - Hover: Increases opacity to 0.3

4. **Action Icons** (Far right):
   - User icon (or UserButton when signed in)
   - Wishlist (heart icon with badge count)
   - Cart (cart icon with badge count)
   - Mobile menu toggle (hamburger, hidden on desktop)
   - All icons: 24px, white color, 44x44px touch targets
   - Hover opacity: 0.8

5. **Mobile Menu Overlay**:
   - Full-screen overlay with Spiced Clementine background
   - Large navigation links (XL size, bold)
   - Search bar at bottom
   - Closes on link click or close button

### TrustBar Component

**Location**: `apps/web/src/app/_components/marketplace/TrustBar.tsx`

**Features**:

- Cream background (`$background` - #FEFAD6)
- Fixed at top (40px height)
- Dismissible with close button (X icon on right)
- Contains promotional message: "Give 10%, Get 10%. Refer a friend."
- Uses local state to hide when dismissed
- Z-index: 100 (above header)

**Layout in Root**:

```tsx
// apps/web/src/app/layout.tsx
<body>
  <NextTamaguiProvider>
    <ServiceWorkerRegistration />
    <TrustBar /> {/* Top: 0px, 40px tall */}
    <ButterHeader /> {/* Top: 40px, 80px tall */}
    <AppPromoBanner /> {/* Below header */}
    {children}
  </NextTamaguiProvider>
</body>
```

**Total Header Stack Height**:

- With TrustBar: 40px (trust) + 80px (header) = 120px
- Without TrustBar (dismissed): 80px (header only)

### Header Best Practices

1. **Color Usage**:
   - Always use `$primary` for header background (Spiced Clementine)
   - Always use `$textInverse` for text/icons on orange background
   - Badge counts use `$secondary` (Burnt Olive) for contrast

2. **Navigation Links**:
   - Use Next.js `Link` component for client-side navigation
   - Add `onClick` handlers to close mobile menu when navigating
   - Use uppercase text for navigation items (brand consistency)

3. **Responsive Behavior**:
   - Desktop (`$lg`+): Show center nav, inline search, all icons
   - Tablet (`$md` - `$lg`): Hide center nav, show hamburger menu
   - Mobile (`< $md`): Search icon only, hamburger menu with full overlay

4. **Sticky Behavior**:
   - Tracks scroll position with `useState` and `useEffect`
   - Adds shadow when scrolled (`stickyMenu` state)
   - Shadow: `rgba(0,0,0,0.12)` with 6px radius

5. **Authentication Integration**:
   - Uses Clerk's `<SignedIn>` and `<SignedOut>` components
   - Shows UserButton when authenticated
   - Shows user icon with sign-in modal when not authenticated
   - UserButton has white filter applied for visibility on orange background

### Migration Notes

**Old Header** (`MarketplaceHeader.tsx`):

- Three-layer structure (TrustBar + Main Header + Nav Bar)
- Total height: 180px
- Green theme (#13a063)
- Search on left side
- Complex desktop menu with categories

**New Header** (`ButterHeader.tsx`):

- Single unified layer
- Total height: 80px (with optional 40px TrustBar)
- Spiced Clementine theme (#F45314)
- Search on right side
- Simplified navigation
- Mobile-first with full-screen overlay

**Breaking Changes**:

- Page layouts expecting 180px margin-top should be updated to 120px (or 80px if TrustBar dismissed)
- Desktop category menu moved to dedicated CategoryGrid component (see homepage refactor)
- Logo now requires white version (`logo-white.png`) instead of orange

## Payments (Stripe)

We use Stripe for payment processing and marketplace functionality (Stripe Connect). The web app handles all payment operations server-side, while the mobile app uses native Stripe SDK for optimal UX.

### Packages

- **Web**: `stripe` (Node.js SDK), `@stripe/stripe-js` (client-side), `@stripe/react-stripe-js` (React components)
- **Mobile**: `@stripe/stripe-react-native` (native iOS/Android SDK)
- **Webhook verification**: Built into `stripe` package

### Architecture

```
┌─────────────────┐
│   Mobile App    │ ──→ Native Stripe SDK (@stripe/stripe-react-native)
│   (React Native)│     └─→ API calls to Next.js backend
└─────────────────┘

┌─────────────────┐
│   Web App       │ ──→ Stripe.js (@stripe/stripe-js)
│   (Next.js)     │     └─→ Server-side Stripe API (stripe)
└─────────────────┘
         │
         ↓
┌─────────────────┐
│ Stripe Connect  │ ──→ Marketplace seller onboarding
│ (Platform)      │     └─→ Automated payouts to sellers
└─────────────────┘
```

### Environment Variables

Place values in `apps/web/.env.local` (see `.env.example`):

```bash
# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_test_...              # Server-side API key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Client-side key
STRIPE_WEBHOOK_SECRET=whsec_...            # Webhook signature verification
```

**Important**:

- Use **test keys** (sk*test*/pk*test*) for development
- Use **live keys** (sk*live*/pk*live*) for production
- Never expose secret keys to clients (only `NEXT_PUBLIC_*` variables)

### Setup Steps

1. **Create Stripe Account**:
   - Create a new Account (not Organization) in Stripe Dashboard
   - Name it "ButterGolf"

2. **Get API Keys**:
   - Navigate to: Developers → API keys
   - Ensure **Test mode** is enabled (toggle at top)
   - Copy both keys to `.env.local`

3. **Enable Stripe Connect**:
   - Go to: Settings → Connect settings
   - Choose: **Platform or marketplace**
   - This enables seller onboarding and automated payouts

4. **Set Up Webhooks**:
   - Go to: Developers → Webhooks
   - Add endpoint: `http://localhost:3000/api/stripe/webhook` (dev) or `https://yourdomain.com/api/stripe/webhook` (prod)
   - Select events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `account.updated` (Connect)
     - `account.application.authorized` (Connect)
     - `account.application.deauthorized` (Connect)
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Web Implementation Pattern

**Server-side (API Routes)**:

```typescript
// apps/web/src/lib/stripe.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// Use this singleton for all server-side Stripe operations
```

**Client-side (React Components)**:

```tsx
// apps/web/src/app/checkout/page.tsx
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutPage() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}
```

### Mobile Implementation Pattern

**IMPORTANT**: Always use the native React Native SDK on mobile for optimal UX and Apple Pay/Google Pay support.

```tsx
// apps/mobile/App.tsx or payment component
import { StripeProvider } from "@stripe/stripe-react-native";

export default function App() {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
      {/* Your app components */}
    </StripeProvider>
  );
}

// Payment screen
import { useStripe } from "@stripe/stripe-react-native";

function PaymentScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Fetch payment intent from your API
  // Initialize and present native payment sheet
}
```

### Stripe Connect (Seller Onboarding)

For marketplace functionality (sellers receiving payouts):

```typescript
// Create Connect account
const account = await stripe.accounts.create({
  type: "express",
  country: "US",
  email: sellerEmail,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});

// Generate onboarding link
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: `${baseUrl}/seller/onboarding/refresh`,
  return_url: `${baseUrl}/seller/onboarding/complete`,
  type: "account_onboarding",
});

// Redirect seller to accountLink.url for embedded onboarding
```

### Best Practices

1. **Server-side validation**: Never trust client data - always verify payments server-side
2. **Webhook handling**: Always verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
3. **Idempotency**: Use idempotency keys for payment operations to prevent duplicates
4. **Error handling**: Catch and handle Stripe errors gracefully (card declined, etc.)
5. **Native SDK on mobile**: Always use `@stripe/stripe-react-native` - don't use web views for payments
6. **Test mode first**: Complete full payment flow in test mode before going live
7. **Connect Express accounts**: Use Express for sellers (simplest onboarding, Stripe handles compliance)

### Common Workflows

**Checkout Flow**:

1. User adds products to cart
2. Backend creates Stripe Checkout Session (or Payment Intent)
3. Frontend receives client secret
4. Mobile: Present native payment sheet / Web: Redirect to Stripe Checkout
5. User completes payment
6. Webhook confirms payment → Update order status in DB

**Seller Onboarding**:

1. User clicks "Become a Seller"
2. Backend creates Stripe Connect account
3. Backend generates onboarding link
4. User completes onboarding (embedded in app or redirect)
5. Webhook confirms account activated → Enable seller features

**Marketplace Payouts**:

- Stripe automatically handles payouts to connected accounts
- Platform fee: Deduct before transfer or use application_fee
- Schedule: Configure in Connect settings (daily, weekly, monthly)

### Testing

Use Stripe test cards:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

Full list: https://stripe.com/docs/testing

### Production Checklist

- [ ] Switch to live API keys in production environment
- [ ] Update webhook endpoint to production URL
- [ ] Test complete checkout flow with real cards (small amounts)
- [ ] Verify Connect onboarding works end-to-end
- [ ] Monitor webhook delivery in Stripe Dashboard
- [ ] Set up payout schedule for sellers
- [ ] Review and accept terms for going live

For detailed Stripe documentation: https://stripe.com/docs

## Image Upload & CDN (Cloudinary)

We use Cloudinary for permanent image hosting, CDN delivery, and AI-powered transformations. This replaced Vercel Blob for a unified image solution.

### Packages

- **Web**: `cloudinary` (Node.js SDK), `next-cloudinary` (Next.js integration)
- **Image transformations**: Background removal, format optimization, quality optimization
- **CDN**: Global CDN delivery with automatic caching

### Architecture

```
┌─────────────────┐
│   Sell Page     │ ──→ ImageUpload component
│   (/sell)       │     └─→ useImageUpload hook
└─────────────────┘
         │
         ↓
┌─────────────────┐
│  Upload API     │ ──→ /api/upload route
│  Route          │     ├─→ Cloudinary SDK upload
└─────────────────┘     ├─→ Background removal (first image)
         │              ├─→ Vanilla Cream background (#FFFAD2)
         │              └─→ Auto format/quality (all images)
         ↓
┌─────────────────┐
│  Cloudinary     │ ──→ Permanent CDN storage
│  CDN            │     └─→ Global delivery + caching
└─────────────────┘
```

### Environment Variables

Place values in `apps/web/.env.local` (see `.env.example`):

```bash
# Cloudinary (Image Uploads & CDN)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

**Important**:

- Use **Cloudinary dashboard** to get credentials (Settings → Access Keys)
- Only `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is exposed to clients
- Keep API key and secret server-side only
- Free tier: 25 GB storage, 25 GB bandwidth, 25,000 transformation credits/month

### Setup Steps

1. **Create Cloudinary Account**:
   - Sign up at [cloudinary.com](https://cloudinary.com)
   - Choose free tier
   - Verify email

2. **Get API Credentials**:
   - Navigate to: Dashboard → Settings → Access Keys
   - Copy: Cloud Name, API Key, API Secret
   - Add to `.env.local` and Vercel environment variables

3. **Cost Optimization**:
   - Background removal applied to **first image only** (cover photo)
   - Reduces transformation credits usage
   - Estimated: ~10 credits per listing (2,500 listings/month on free tier)

### Background Removal Logic

**Cover Photo Optimization (First Image Only)**:

```typescript
// Transformations applied automatically in /api/upload
{
  effect: 'background_removal',  // AI-powered background removal
  background: 'rgb:FFFAD2',      // Vanilla Cream brand color (#FFFAD2)
}
```

**Other Images**:

```typescript
// No transformations at upload time - stored as-is
// Auto format/quality can be applied via URL when displaying
```

**Why First Image Only?**

- ✅ **Cost effective** - Reduces Cloudinary transformation credits
- ✅ **Visual consistency** - Cover photo most visible in listings/search
- ✅ **Context preserved** - Other images show product in natural setting
- ✅ **Fallback graceful** - If removal fails, original image is used

### Upload Flow Implementation

**Client-Side Hook** (`apps/web/src/hooks/useImageUpload.ts`):

```typescript
// Pass isFirstImage flag for background removal
const upload = async (file: File, isFirstImage = false): Promise<UploadResult> => {
  const response = await fetch(
    `/api/upload?filename=${encodeURIComponent(filename)}&isFirstImage=${isFirstImage}`,
    {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    }
  );
  // Returns Cloudinary CDN URL
};
```

**Server-Side API** (`apps/web/src/app/api/upload/route.ts`):

```typescript
import { v2 as cloudinary } from "cloudinary";

// Configure once at module load
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload with conditional transformations
const uploadOptions = {
  folder: "products",
  format: "auto",
  quality: "auto",
};

if (isFirstImage) {
  uploadOptions.transformation = [{ effect: "background_removal" }, { background: "rgb:FFFAD2" }];
}

const result = await cloudinary.uploader.upload(base64Image, uploadOptions);
// Returns: result.secure_url (permanent CDN URL)
```

### URL Structure & Database Storage

**Cloudinary URLs are permanent CDN URLs** - store them directly in your database:

```typescript
// Prisma schema
model Product {
  id     String   @id @default(cuid())
  images String[] // Array of Cloudinary URLs
}

// Example URL
"https://res.cloudinary.com/buttergolf/image/upload/e_background_removal,b_rgb:FFFAD2/products/1732000000-abc123.jpg"
```

**On-the-fly transformations** (add to URL for different sizes):

```
# Thumbnail (150x150)
.../w_150,h_150,c_fill/products/abc123.jpg

# Product listing (400x400)
.../w_400,h_400,c_fit/products/abc123.jpg

# Full size (original)
.../products/abc123.jpg
```

### Best Practices

1. **Store Cloudinary URLs** - No need for separate file storage, Cloudinary IS the permanent host
2. **First image gets branded background** - Cover photo is most important for consistency
3. **Auto optimization is free** - Apply to all images for better performance
4. **Fallback gracefully** - If background removal fails, use original image (no error shown)
5. **Monitor usage** - Check Cloudinary dashboard monthly for credit usage
6. **Use transformations** - Resize images via URL parameters instead of uploading multiple sizes

### Common Issues

**Error: "Image upload is not configured"**

- **Cause**: Missing environment variables
- **Fix**: Add all three Cloudinary variables to `.env.local` and Vercel

**Background removal not applied**

- **Cause**: AI may fail on certain images (unclear subject, low quality)
- **Fix**: Automatic fallback to original image (no action needed)

**Images not displaying**

- **Cause**: Incorrect cloud name in database URLs
- **Fix**: Verify URLs match format: `https://res.cloudinary.com/{cloud_name}/...`

For detailed setup instructions, see `docs/CLOUDINARY_SETUP.md`.

## Documentation References

### Tamagui Documentation (PRIMARY REFERENCE)

**CRITICAL: Always reference Tamagui docs for component usage, styling patterns, and theming.**

- **Full LLM-Optimized Documentation**: https://tamagui.dev/llms-full.txt (complete single-file reference)
- **Quick Overview**: https://tamagui.dev/llms.txt (structured overview with links)
- **Core Concepts**: https://tamagui.dev/docs/intro/introduction

**Core Documentation:**

- [Animations](https://tamagui.dev/docs/core/animations.md): Animation system and utilities
- [Config V4](https://tamagui.dev/docs/core/config-v4.md): Version 4 configuration guide
- [Configuration](https://tamagui.dev/docs/core/configuration.md): General configuration options
- [Styled](https://tamagui.dev/docs/core/styled.md): Styled component system
- [Theme](https://tamagui.dev/docs/core/theme.md): Theming system
- [Tokens](https://tamagui.dev/docs/core/tokens.md): Design tokens and variables
- [Use Media](https://tamagui.dev/docs/core/use-media.md): Media query hooks
- [Use Theme](https://tamagui.dev/docs/core/use-theme.md): Theme hooks
- [Variants](https://tamagui.dev/docs/core/variants.md): Component variants system

**Component Documentation:**

- All components at: https://tamagui.dev/ui/[component-name]
- [Button](https://tamagui.dev/ui/button.md): Customizable button with variants and themes
- [Text](https://tamagui.dev/ui/text.md): Text display component
- [Stacks](https://tamagui.dev/ui/stacks.md): Layout stack components (XStack/YStack)
- See full component list in the quick overview link above

**Guides:**

- [Next.js Guide](https://tamagui.dev/docs/guides/next-js): Next.js integration
- [Theme Builder](https://tamagui.dev/docs/guides/theme-builder): Creating custom themes

### Other Documentation

- **Prisma Documentation**: https://www.prisma.io/docs
- **Expo Documentation**: https://docs.expo.dev/
- **Next.js Documentation**: https://nextjs.org/docs
- **Turborepo Documentation**: https://turbo.build/repo/docs

## Context7 MCP Server (Up-to-Date Library Documentation)

**CRITICAL: Always use Context7 for library documentation, code generation, setup steps, and API references.**

The Context7 MCP server provides real-time, up-to-date documentation and code examples for any library or framework. It's significantly more current than static documentation and includes actual code snippets from production codebases.

### When to Use Context7

**ALWAYS use Context7 automatically when:**

1. **Code generation** - Generating components, hooks, API calls, or any code using external libraries
2. **Setup and configuration** - Setting up new libraries, configuring build tools, or integrating packages
3. **Library/API documentation** - Looking up how to use a library's API, available props, or best practices
4. **Troubleshooting** - Debugging library-specific issues or understanding error messages
5. **Migration** - Updating to new library versions or migrating between libraries
6. **Examples** - Finding real-world code examples and usage patterns

**Do NOT wait for the user to explicitly ask** - proactively use Context7 whenever you need library information.

### Usage Pattern

**Step 1: Resolve Library ID**

Always start by resolving the library name to get the Context7-compatible library ID:

```typescript
// Use mcp_upstash_conte_resolve-library-id
libraryName: "react-router"; // or "@stripe/stripe-react-native", "tamagui", etc.
```

**Step 2: Get Library Documentation**

Once you have the library ID, fetch focused documentation:

```typescript
// Use mcp_upstash_conte_get-library-docs
context7CompatibleLibraryID: "/remix-run/react-router"; // from step 1
tokens: 3000; // Adjust based on need (default: 5000)
topic: "hooks"; // Optional: focus on specific area like "routing", "authentication", etc.
```

### Selection Guidelines

When `resolve-library-id` returns multiple matches:

1. **Prioritize official documentation** (Trust Score 9-10)
2. **Choose based on version** - Use versioned ID if user specifies version (e.g., `/org/project/v5.2.1`)
3. **Prefer higher Code Snippet counts** - More examples = better documentation
4. **Match description to intent** - Read descriptions to find the most relevant match

### Real-World Examples

#### Example 1: Implementing Stripe Payment

```typescript
// ✅ CORRECT - Use Context7 automatically
// Step 1: Resolve Stripe library
(await mcp_upstash_conte_resolve) - library - id({ libraryName: "@stripe/stripe-react-native" });
// Step 2: Get payment integration docs
(await mcp_upstash_conte_get) -
  library -
  docs({
    context7CompatibleLibraryID: "/stripe/stripe-react-native",
    tokens: 3000,
    topic: "payment sheet",
  });
// Step 3: Generate code using the examples from Context7

// ❌ WRONG - Don't rely on static knowledge or outdated documentation
// Generating code without checking current API patterns
```

#### Example 2: Adding Navigation

```typescript
// ✅ CORRECT - Check latest React Router patterns
(await mcp_upstash_conte_resolve) - library - id({ libraryName: "react-router" });
(await mcp_upstash_conte_get) -
  library -
  docs({
    context7CompatibleLibraryID: "/remix-run/react-router",
    tokens: 2000,
    topic: "navigation hooks",
  });

// ❌ WRONG - Using potentially outdated patterns from training data
```

#### Example 3: Tamagui Component Setup

```typescript
// ✅ CORRECT - Get current Tamagui best practices
(await mcp_upstash_conte_resolve) - library - id({ libraryName: "tamagui" });
(await mcp_upstash_conte_get) -
  library -
  docs({
    context7CompatibleLibraryID: "/tamagui/tamagui",
    tokens: 2000,
    topic: "styled components",
  });
```

### Integration with Existing Workflow

**Before writing code that uses external libraries:**

1. Use Context7 to get current documentation
2. Review code examples and API patterns
3. Generate code following the examples
4. Reference Context7 output in code comments if helpful

**When user asks about libraries:**

- Don't just answer from static knowledge
- Fetch Context7 docs first
- Provide answer based on current documentation
- Include relevant code examples from Context7

### Benefits

- **Up-to-date**: Docs reflect latest library versions and best practices
- **Real examples**: Code snippets from production codebases, not just docs
- **Comprehensive**: Covers edge cases and common pitfalls
- **Accurate**: Based on actual library implementations, not LLM training data
- **Efficient**: Targeted documentation (use `topic` parameter) reduces token usage

### Remember

**Context7 is not optional** - it's a critical tool for ensuring code quality and accuracy. Always use it proactively when working with external libraries, frameworks, or APIs. Don't wait to be asked - make it part of your standard workflow.

## Best Practices

### Critical: Size System Rules

**⚠️ MOST COMMON ERROR: Using outdated size system documentation**

0. **ALWAYS use standard Tamagui size prop with numeric tokens**:
   - **Text/SizableText/Paragraph**: Use `size="$1"` through `size="$16"` (standard Tamagui)
   - **Button**: Use `size="$1"` through `size="$16"` (standard Tamagui numeric tokens)
   - **Input, Badge, Spinner**: Use `size="sm" | "md" | "lg"` (custom variants for these specific components)
   - ❌ WRONG: `<Text fontSize="$5">` → Use size prop, not fontSize
   - ✅ CORRECT: `<Text size="$5">` → Standard Tamagui pattern
   - ❌ WRONG: `<Button size="lg">` → Use numeric tokens
   - ✅ CORRECT: `<Button butterVariant="primary" size="$5">` → Use butterVariant + numeric size
   - **See full documentation**: Official Tamagui docs confirm Text/Button use `size` prop

### Design System & Components

1. **ALWAYS use semantic color tokens in app code** - PREFER `$primary`, `$text`, `$textSecondary`, `$textMuted`, `$border`, `$background`, `$surface` for automatic theme switching. Use brand tokens (`$ironstone`, `$spicedClementine`, `$vanillaCream`) only in `packages/ui` component definitions or when you need a specific color that won't change with themes. Never use raw hex values or numbered colors.
2. **ALWAYS use butterVariant for styled buttons** - Use `<Button butterVariant="primary" size="$5">` for primary buttons and `<Button butterVariant="secondary" size="$4">` for secondary buttons. Use `chromeless` for ghost/tab buttons. Avoid inline `backgroundColor`/`color` props on buttons.
3. **ALWAYS use Text size with numeric tokens** - Use `<Text size="$5">` for body text, `size="$3"` for small text. This is the standard Tamagui pattern (NOT fontSize).
4. **ALWAYS use Text color with direct tokens** - Use `<Text color="$text">` or `<Text color="$textMuted">` (Text has NO color variants)
5. **ALWAYS use compound components for Cards** - Use `<Card.Header>` instead of `<CardHeader>`
6. **ALWAYS use layout components** - Use `<Row>`, `<Column>`, `<Container>` instead of raw `<XStack>`/`<YStack>`
7. **NEVER use numbered colors** - Don't use `$color9`, `$color11`, `$blue10`, etc.
8. **NEVER use old token names** - Don't use `$borderColor`, `$textDark`, `$bg`, `$color`, etc.
9. **NEVER mix Tamagui and Tailwind** - Keep Tamagui for components, Tailwind for page layouts only

### 🚨 NEVER Use Tamagui Components in Server Components

**CRITICAL BUILD FAILURE**: Tamagui uses `React.createContext()` at module load time. This BREAKS during Next.js "Collecting page data" phase in server components with error: `TypeError: f.createContext is not a function`

```tsx
// ❌ WRONG - Server component importing Tamagui (CAUSES BUILD FAILURE)
import { Column } from "@buttergolf/ui";

export default async function Layout({ children }) {
  const { userId } = await auth(); // Server-only code
  return <Column>{children}</Column>; // 💥 BUILD FAILS HERE
}

// ✅ CORRECT - Use plain HTML in server components
export default async function Layout({ children }) {
  const { userId } = await auth();
  return <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>;
}
```

**The Rule**: NEVER import ANY Tamagui component (Column, Row, Text, Button, Card, etc.) in:

- `layout.tsx` without `"use client"`
- `page.tsx` without `"use client"`
- Server Actions
- API routes

**Why**: Tamagui was designed for React Native + Web where everything is client-side. Next.js App Router server components are a completely different execution model that Tamagui does not support.

### Common React/Tamagui Errors to Avoid

10. **ALWAYS use props on their correct component type** - Text/typography props belong on Text components, not layout containers

- ❌ WRONG: `<Column textAlign="center">` → textAlign is a text property, not a layout property
- ✅ CORRECT: `<Text textAlign="center">` → Use on Text components
- ❌ WRONG: Wrapping text props in style object on wrong component types
- ✅ CORRECT: Apply text styling props (textAlign, whiteSpace, etc.) directly to Text/Button components

**Tamagui Component Inheritance**:

- Button extends Stack → inherits ALL Stack props including whiteSpace, flexShrink, cursor, etc.
- Text extends SizableText → inherits text props like textAlign, whiteSpace, etc.
- ❌ **NEVER use `{...{ prop: value as any }}` escape hatches** - This bypasses type safety
- ✅ **Use `style` prop for web-only CSS** that React Native doesn't support (position: sticky, overflow: auto)
- ✅ **Use direct props** for standard React/Tamagui properties the component already supports

11. **ALWAYS use optional chaining for potentially undefined props** - Especially when passing data from server components
    - ❌ WRONG: `availableBrands={availableFilters.availableBrands}` → Runtime error if undefined
    - ✅ CORRECT: `availableBrands={availableFilters?.availableBrands || []}`
    - Apply to all nested property access: `data?.category?.name || 'Default'`

12. **ALWAYS await params and searchParams in Next.js 15+ page components** - They are Promises now
    - ❌ WRONG: `params.slug` → Runtime error in Next.js 15+
    - ✅ CORRECT: `const resolvedParams = await params; resolvedParams.slug`
    - Update Props interface: `params: Promise<{ slug: string }>` not `params: { slug: string }`

### Understanding Variants vs Direct Token Props

**CRITICAL DISTINCTION:** Tamagui has two ways to use design tokens:

#### 1️⃣ **Custom Variants** (For NEW Component APIs Only)

Variants are **named options** defined in `styled()` components. They use **plain strings WITHOUT `$`** that map to tokens internally.

```tsx
// ✅ CORRECT - Using custom variants (NO $ prefix)
<Button size="lg">          // "lg" is a variant option
<Text color="muted">        // "muted" is a variant option
<Card padding="lg">         // "lg" is a variant option

// Defined in styled() like this:
const Button = styled(View, {
  variants: {
    size: {
      lg: { height: '$10', paddingHorizontal: '$4' },
    }
  }
})
```

**⚠️ IMPORTANT:** Never create variants for props that **already exist on the base component** (like `gap`, `padding`, `margin`). This causes TypeScript intersection type errors!

**When to use:** Component-specific props that have a fixed set of semantic options (button size/tone, card variant, text color schemes).

#### 2️⃣ **Direct Token Props** (For Layout & Styling)

Direct props accept token values **WITH `$`** for ad-hoc styling on any Tamagui component. This is how Tamagui's built-in components work.

```tsx
// ✅ CORRECT - Using direct token props (WITH $ prefix)
<Row gap="$xl">                         // Use tokens directly - gap is native to XStack
<Column gap="$lg">                      // Use tokens directly - gap is native to YStack
<View padding="$md">                    // Direct token reference
<YStack gap="$4">                       // Direct token reference
<Text fontSize="$5">                    // Direct token reference
<View backgroundColor="$surface">       // Direct token reference
<View borderRadius="$lg">               // Direct token reference
```

**When to use:** Layout spacing (gap, padding, margin), geometric properties (width, height, borderRadius), and any prop that exists natively on the base component.

### When to Use Which Pattern

#### ✅ Use Custom Variants For:

1. **Component identity** - Button size/tone, Input size, Card variant
2. **Semantic options** - Text colors (muted, secondary)
3. **Design system boundaries** - Enforcing approved sizes/colors
4. **Component-specific props** - Container maxWidth, Card padding
5. **Better DX** - Autocomplete, type safety, prevents one-offs

#### ✅ Use Direct Tokens For:

1. **Layout spacing** - padding, margin on containers
2. **Geometric props** - borderRadius, borderWidth, width, height
3. **One-off containers** - Temporary View/YStack wrappers
4. **Advanced layouts** - Complex positioning, absolute positioning
5. **Prototyping** - Quick iteration before creating variants

### Real-World Examples

```tsx
// ✅ CORRECT - Mixed usage based on context

// Layout components use DIRECT TOKENS for native props
<Row gap="$md" alignItems="center">    // gap="$md" - direct token (native prop)
  <Column gap="$lg">                     // gap="$lg" - direct token (native prop)
    <Text color="$textMuted" size="$4">  // color & size - both direct tokens
      Helper text
    </Text>
  </Column>
</Row>

// Primitives use direct tokens (flexible, ad-hoc)
<View padding="$4" backgroundColor="$surface" borderRadius="$md">
  <YStack gap="$3">
    <Text size="$4" color="$text">Direct token usage</Text>
  </YStack>
</View>

// Standard Tamagui Button uses direct props
<Button size="$5" backgroundColor="$primary" color="$textInverse">
  Submit
</Button>

// Custom components use their defined variants
<Card variant="elevated" padding="lg">  // variant/padding - custom variants
  <Card.Body>
    <Text>Content</Text>
  </Card.Body>
</Card>
```

### Token Usage Cheat Sheet

```tsx
// ✅ CORRECT - Direct tokens (WITH $ prefix) for layout components
<Row gap="$xl">                   // Row/Column use DIRECT tokens (gap is native to XStack)
<Column gap="$lg">                // Don't use variants for native props!
<YStack gap="$4">                 // Direct prop on primitive
<View padding="$md">              // Direct prop on primitive
<Text size="$5" color="$textMuted"> // Direct token references
<Button size="$4" backgroundColor="$primary"> // Standard Tamagui Button with direct props
<View borderRadius="$lg">         // Direct geometric prop
<View backgroundColor="$surface"> // Direct color token

// ✅ CORRECT - Custom variants (NO $ prefix) for component-specific props
<Card padding="lg">               // Card component variant (custom, not native padding)
<Container size="lg">             // Container size variant

// ❌ WRONG - Creating variants for native props
<Row gap="md">                    // ❌ gap exists natively, use gap="$md"
<Column gap="lg">                 // ❌ gap exists natively, use gap="$lg"

// ❌ WRONG - Mixing them up
<View padding="md">               // ❌ Missing $ for direct prop

// ❌ WRONG - Using old token names
<Text color="$color">             // ❌ Old token name, use $text
<View borderColor="$borderColor"> // ❌ Old token name, use $border
```

### Component Usage Cheat Sheet

```tsx
// ✅ CORRECT Component Usage
<Button size="$5" backgroundColor="$primary" color="$textInverse">Submit</Button>
<Text color="$textMuted" size="$4">Helper text</Text>
<Card variant="elevated" padding="lg">
  <Card.Header><Heading level={3}>Title</Heading></Card.Header>
  <Card.Body><Text>Content</Text></Card.Body>
</Card>
<Row gap="$md" alignItems="center">
  <Text>Label</Text>
  <Spacer flex />
  <Button>Action</Button>
</Row>

// ❌ WRONG Component Usage
<Button paddingHorizontal="$5" backgroundColor="$spicedClementine">Submit</Button>
<Text fontSize="$3" color="$gray500">Helper text</Text>
<Row gap="md">Wrong - use gap="$md"</Row>
<Card elevate size="$4" bordered>
  <CardHeader padding="$3">Title</CardHeader>
</Card>
<XStack gap="$4" alignItems="center">
  <Text>Label</Text>
  <View flex={1} />
  <Button>Action</Button>
</XStack>
```

### Component Design Decision Matrix

Use this matrix when creating or updating components:

| Property Type              | Use Variant                      | Use Direct Token           | Example                                              |
| -------------------------- | -------------------------------- | -------------------------- | ---------------------------------------------------- |
| **Spacing (gap, padding)** | ❌ DON'T (native props)          | ✅ Always use tokens       | `<Row gap="$md">` (gap is native to XStack)          |
| **Sizing (width, height)** | ✅ For semantic sizes (sm/md/lg) | ⚠️ For specific dimensions | `<Input size="md">` vs `<View width={200}>`          |
| **Colors**                 | ✅ For semantic tokens           | ⚠️ For brand tokens in UI  | `<Text color="$text">` or `color="$primary"`         |
| **Typography (size)**      | ❌ No variants on Text           | ✅ Use numeric tokens      | `<Text size="$5">` (standard Tamagui pattern)        |
| **Border radius**          | ⚠️ Rare (use defaults)           | ✅ For geometric control   | Usually inherit, or `borderRadius="$md"`             |
| **Alignment**              | ❌ No custom variants            | ✅ Use native flexbox      | `<Row alignItems="center">` native React Native prop |
| **Component state**        | ✅ Always (tone, variant)        | ❌ Never                   | `<Button tone="primary">` never manual colors        |

**Legend:**

- ✅ Preferred approach
- ⚠️ Use case dependent
- ❌ Avoid/Never

### Variant Design Guidelines

When creating a new component, add variants for:

1. **Must Have:**
   - `size` - If component has sizing (sm, md, lg)
   - `variant` or `tone` - Visual style variations
2. **Should Have:**
   - Component-specific semantics (e.g., `align` for Row, `level` for Heading)
   - Common states (active, disabled) if not in base component
3. **Nice to Have:**
   - `fullWidth` / `fullHeight` - If commonly needed
   - Spacing variants if component commonly wraps content

4. **Don't Variant:**
   - One-off values (use direct props)
   - Geometric properties (width, height numbers)
   - Complex positioning (absolute, z-index)

### General Best Practices

9. **Always use Tamagui components** from `@buttergolf/ui` for cross-platform consistency
10. **CRITICAL: Always use semantic color tokens in app code** - Use `$primary`, `$text`, `$textSecondary`, `$textMuted`, `$border`, `$background`, `$surface` for automatic theme switching and maintainability. Only use brand tokens (`$ironstone`, `$spicedClementine`, `$vanillaCream`) when defining component defaults in `packages/ui` or when you need a specific color that absolutely won't change with themes. Never use raw hex values or numbered colors.
11. **CRITICAL: Always use standard Tamagui Button component** - Never create manual HTML `<button>` elements with inline styles. Import `{ Button }` from `@buttergolf/ui` and use standard Tamagui numeric size tokens (`size="$4"`) with direct prop styling (`backgroundColor`, `color`, `paddingHorizontal`, `paddingVertical`, `borderRadius`). We removed custom variants (size="sm|md|lg", tone="primary|outline") to use standard Tamagui patterns. This ensures consistency, proper theming, hover/press states, and cross-platform compatibility.
12. **Keep React versions aligned** across web and mobile
13. **Use workspace protocol** for internal dependencies: `"workspace:*"`
14. **Export types** alongside components for better DX
15. **Test on both platforms** before considering features complete
16. **Leverage media queries** for responsive design instead of platform checks
17. **Keep Metro and Babel configs** in sync with Tamagui requirements
18. **Run type checking** regularly during development
19. **Use `name` prop** on styled components for better compiler optimization
20. **Use Prisma Client singleton** from `@buttergolf/db` - never create new instances
21. **Run `pnpm db:generate`** after any schema changes
22. **Use migrations** (`db:migrate:dev`) for production-bound changes, `db:push` for quick dev iteration
23. **Define variants for common patterns** - If you're writing the same props 3+ times, make it a variant
24. **Use direct tokens for one-offs** - Don't create variants for rarely-used combinations
25. **Avoid `style` prop in shared code** - In `packages/ui` and `packages/app`, use Tamagui's native props so the compiler can optimize. In web-only files (`apps/web`), you may use `style` for genuine web-only CSS like `position: sticky` or `overflow: auto`.
26. **Use Tamagui Text with fontSize tokens** - In shared cross-platform code, use `<Text fontSize="$5">` with numeric tokens. For web-only custom typography (like CSS clamp), create dedicated components in `apps/web` or use Tailwind classes. Trust the lineHeight values defined in `packages/config/src/tamagui.config.ts` - avoid manual overrides unless absolutely necessary.

### British Spelling Convention

**This project uses British English spelling throughout the codebase.** ESLint rules enforce this automatically.

27. **CRITICAL: Always use British spellings** - Use `favourite` not `favorite`, `favourites` not `favorites`. ESLint will flag American spellings as warnings.
28. **Exceptions for APIs/CSS** - You cannot change JavaScript APIs (`behavior` in `scrollIntoView`) or CSS properties (`color`, `center`). These are hardcoded in the language/frameworks.
29. **Database uses British spelling** - The Prisma schema uses `Favourite` model and `favourites` relations. The generated client follows this.
30. **ESLint enforcement** - The `no-restricted-syntax` rule in `packages/eslint-config/base.js` flags identifiers containing `favorite` or `favorites`.

### Animation Patterns (Tamagui-Based)

**We use Tamagui's built-in animation system, not GSAP.** All animations use `@tamagui/animations-react-native` with spring-based presets.

27. **Use `AnimatedView` for page-load animations:**

```tsx
// apps/web/src/app/_components/animations/AnimatedView.tsx
import { AnimatedView } from "./animations/AnimatedView";

// Staggered entrance with millisecond delays
<AnimatedView delay={0}><Hero /></AnimatedView>
<AnimatedView delay={200}><Toggle /></AnimatedView>
<AnimatedView delay={400}><Categories /></AnimatedView>
```

28. **Use Tamagui's enterStyle for inline animations:**

```tsx
<View animation="medium" enterStyle={{ opacity: 0, y: 30 }} opacity={1} y={0}>
  {children}
</View>
```

29. **Use CSS @keyframes for infinite/loop animations:**

- For carousels or infinite scroll, use pure CSS animations
- Example: `CategoriesSection.tsx` uses CSS `@keyframes scroll-infinite`
- No JavaScript animation libraries needed

30. **Animation preset reference (from tamagui.config.ts):**

- `animation="fast"` - Quick response (0.3 damping)
- `animation="medium"` - Default, balanced (0.5 damping)
- `animation="slow"` - Smooth, deliberate (0.7 damping)
- `animation="bouncy"` - Playful spring (0.5 damping, 2 stiffness)
- `animation="lazy"` - Slow reveal (0.9 damping)
- `animation="quick"` - Snappy (0.4 damping)

31. **Respect prefers-reduced-motion:**

```tsx
const prefersReducedMotion = useMemo(() => {
  if (globalThis.window === undefined) return false;
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}, []);

if (prefersReducedMotion) {
  return <View>{children}</View>; // No animation
}
```

## Known Issues & Gotchas

1. **TypeScript Errors in UI Package**: Some Tamagui component re-exports may show TypeScript errors about missing module exports, but runtime typically works fine
2. **React Version Alignment**: Keep React at 19.2.0 across all packages to avoid peer dependency conflicts
3. **Metro Cache**: Clear Metro cache frequently when making config changes
4. **Path Aliases**: Always use TypeScript path mappings instead of relative imports for cross-package references
5. **Tamagui Build Folder**: The `.tamagui` directory is auto-generated - add to `.gitignore`

## Code Generation Hints

When generating new code:

- **USE CONTEXT7 FIRST** - Before generating code with external libraries, use Context7 MCP to get current documentation
- Default to Tamagui components over React Native primitives
- Use `styled()` for component definitions
- Include `name` property for compiler optimization
- Export both component and type
- Use semantic tokens ($ prefix) - NEVER use numbered colors
- ALWAYS use component variants instead of manual styling
- ALWAYS use Text color variants (color="muted" not color="$textMuted")
- ALWAYS use compound components for Cards
- ALWAYS use layout components (Row, Column, Container)
- Include responsive variants with media queries
- Add hover/press/focus styles where appropriate
- Follow compound component pattern for complex UIs
- Always wrap in TamaguiProvider when creating new entry points

## Common UI Patterns

### Form with Validation

```tsx
<Column gap="$lg" fullWidth>
  <Column gap="$xs">
    <Row gap="$xs">
      <Label htmlFor="email">Email</Label>
      <Text color="$error">*</Text>
    </Row>
    <Input id="email" type="email" size="md" error={!!emailError} fullWidth />
    {emailError && (
      <Text size="$4" color="$error">
        {emailError}
      </Text>
    )}
  </Column>

  <Button size="$5" backgroundColor="$primary" color="$textInverse" width="100%">
    Submit
  </Button>
</Column>
```

### Product Card

```tsx
<Card variant="elevated" padding="none" fullWidth>
  <Card.Header padding="none" noBorder>
    <Image
      source={{ uri: product.imageUrl }}
      width="100%"
      height={200}
      borderTopLeftRadius="$lg"
      borderTopRightRadius="$lg"
    />
  </Card.Header>

  <Card.Body padding="lg">
    <Column gap="$sm">
      <Heading level={4}>{product.name}</Heading>
      <Text color="$textSecondary">{product.category}</Text>
      <Row alignItems="center" justifyContent="space-between">
        <Text size="$8" fontWeight="700">
          ${product.price}
        </Text>
        <Badge variant="success">In Stock</Badge>
      </Row>
    </Column>
  </Card.Body>

  <Card.Footer align="right">
    <Button
      size="$4"
      backgroundColor="transparent"
      color="$primary"
      borderWidth={2}
      borderColor="$primary"
    >
      Add to Cart
    </Button>
  </Card.Footer>
</Card>
```

### Dashboard Stats

```tsx
<Row gap="$lg" flexWrap="wrap">
  <Card variant="filled" padding="lg" flex={1}>
    <Column gap="$sm">
      <Row alignItems="center" gap="$sm">
        <Badge variant="success" dot />
        <Text color="$textSecondary">Active Users</Text>
      </Row>
      <Heading level={2}>1,234</Heading>
      <Text size="$4" color="$success">
        +12% from last month
      </Text>
    </Column>
  </Card>

  <Card variant="filled" padding="lg" flex={1}>
    <Column gap="$sm">
      <Row alignItems="center" gap="$sm">
        <Badge variant="info" dot />
        <Text color="$textSecondary">Revenue</Text>
      </Row>
      <Heading level={2}>$45.2K</Heading>
      <Text size="$4" color="$info">
        +8% from last month
      </Text>
    </Column>
  </Card>
</Row>
```

### Loading State

```tsx
<Card variant="elevated" padding="lg">
  <Column gap="$md" alignItems="center">
    <Spinner size="lg" color="$primary" />
    <Text color="$textSecondary">Loading content...</Text>
  </Column>
</Card>
```

### Alert/Notification

```tsx
<Card variant="outlined" padding="md">
  <Row gap="$md" alignItems="flex-start">
    <Badge variant="error" size="sm" />
    <Column gap="$xs" flex={1}>
      <Text fontWeight="600">Error</Text>
      <Text color="$textSecondary">Something went wrong. Please try again.</Text>
    </Column>
    <Button size="$3" chromeless>
      Dismiss
    </Button>
  </Row>
</Card>
```

### Responsive Layout

```tsx
<Container size="lg">
  <Column
    gap="$md"
    $gtMd={{ gap: "$lg" }} // Larger gap on desktop
  >
    <Row
      flexDirection="column"
      $gtSm={{ flexDirection: "row" }} // Horizontal on tablet+
      gap="$md"
    >
      <Column flex={1}>Content 1</Column>
      <Column flex={1}>Content 2</Column>
    </Row>
  </Column>
</Container>
```

## SEO Foundations (Next.js Web)

### Sitemap & robots.txt

The web app uses `next-sitemap` to automatically generate XML sitemaps and robots.txt files:

- **Configuration**: `apps/web/next-sitemap.config.js`
- **Generation**: Automatically runs after build via `postbuild` script
- **Environment**: Set `SITE_URL` environment variable for production URLs
- **Exclusions**: API routes, auth pages, and error pages are excluded

**When to Update:**

- Adding new public routes → Ensure they're not in the exclude list
- Adding admin/draft routes → Add to exclude list
- Changing route structure → Update transform function priorities

**Validation:**

- After build, check `apps/web/public/sitemap.xml` exists
- Verify `apps/web/public/robots.txt` references the sitemap
- Submit sitemap to Google Search Console in production

### Structured Data (JSON-LD)

Structured data enables rich search results and helps search engines understand content:

- **Helper Component**: `apps/web/src/components/seo/SeoJsonLd.tsx`
- **Usage**: Import and add to any page component

**Available Schema Types:**

- **Home/Organization**: `Organization` + `WebSite` (with SearchAction)
- **Product Pages**: `Product` with offers, brand, availability
- **Blog/Articles**: `BlogPosting` or `Article` (when implemented)

**Example Usage:**

```tsx
import { SeoJsonLd } from "@/components/seo";

export default function MyPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Product Name",
    description: "Product description",
    // ... more fields
  };

  return (
    <>
      <YourPageContent />
      <SeoJsonLd data={schema} />
    </>
  );
}
```

**Best Practices:**

- Use absolute HTTPS URLs for images and links
- Populate from source of truth (database, CMS, props)
- Include all required fields for the schema type
- Test with [Google Rich Results Test](https://search.google.com/test/rich-results)

### Mobile App Deep Linking

Universal Links (iOS) and App Links (Android) configuration:

**Web Side:**

- `.well-known/apple-app-site-association` - iOS configuration
- `.well-known/assetlinks.json` - Android configuration
- Both files located in `apps/web/public/.well-known/`

**Mobile Side:**

- iOS: `bundleIdentifier` and `associatedDomains` in `apps/mobile/app.json`
- Android: `package` and `intentFilters` in `apps/mobile/app.json`

**Setup Requirements:**

1. Update Team ID in `apple-app-site-association`
2. Update package names to match your app
3. Add SHA256 fingerprint to `assetlinks.json` (from Android keystore)
4. Ensure files are accessible at `https://yourdomain.com/.well-known/*`

**Testing:**

- iOS: Tap a link in Messages/Mail with app installed
- Android: Tap a link in browser/app with app installed
- Verify app opens instead of browser

### CI/CD Integration

**GitHub Actions Workflow**: `.github/workflows/seo-check.yml`

Automatically validates:

- ✅ Sitemap generation
- ✅ robots.txt existence and format
- ✅ JSON-LD component usage
- ✅ .well-known files for app linking

**Runs on:**

- Pull requests affecting web app routes or components
- Manual workflow dispatch

### PR Checklist for SEO Changes

When adding or modifying pages:

- [ ] Updated `next-sitemap.config.js` if route should be excluded
- [ ] Added JSON-LD structured data for new page types
- [ ] Tested structured data with Google Rich Results Test
- [ ] Verified sitemap includes new routes (or excludes appropriately)
- [ ] Updated deep linking paths if mobile app should handle route

### Staging vs Production

**Staging:**

- Use environment variables to control indexing
- Consider password protection or `ROBOTS_DISALLOW_ALL=true`
- Test sitemap generation works correctly

**Production:**

- Set `SITE_URL` to production domain
- Ensure robots.txt allows indexing
- Submit sitemap to Google Search Console
- Monitor Search Console for errors

### Common Issues

**Sitemap not generating:**

- Check `postbuild` script runs after Next.js build
- Verify `SITE_URL` environment variable is set
- Check build logs for next-sitemap errors

**JSON-LD not appearing:**

- Ensure server-side rendering is enabled (not client-only)
- Check browser source (not inspector) for script tag
- Validate JSON syntax with online validator

**Deep links not working:**

- Verify .well-known files are publicly accessible (200 OK)
- Check Team ID and package names match exactly
- Test on physical device (simulators have limitations)
- Review Android logcat for App Links verification

## Tamagui Documentation

If you want all docs as a single document, see docs/TAMAGUI_DOCUMENTATION.md.

> Tamagui is a complete UI solution for React Native and Web, with a fully-featured UI kit, styling engine, and optimizing compiler.

This documentation covers all aspects of using Tamagui, from installation to advanced usage.

## Core

Core documentation covers the fundamental styling and configuration aspects of Tamagui:

- [Animations](https://tamagui.dev/docs/core/animations.md): Animation system and utilities
- [Config V4](https://tamagui.dev/docs/core/config-v4.md): Version 4 configuration guide
- [Configuration](https://tamagui.dev/docs/core/configuration.md): General configuration options
- [Exports](https://tamagui.dev/docs/core/exports.md): Available exports and utilities
- [Font Language](https://tamagui.dev/docs/core/font-language.md): Font and language settings
- [Stack and Text](https://tamagui.dev/docs/core/stack-and-text.md): Basic layout components
- [Styled](https://tamagui.dev/docs/core/styled.md): Styled component system
- [Theme](https://tamagui.dev/docs/core/theme.md): Theming system
- [Tokens](https://tamagui.dev/docs/core/tokens.md): Design tokens and variables
- [Use Media](https://tamagui.dev/docs/core/use-media.md): Media query hooks
- [Use Theme](https://tamagui.dev/docs/core/use-theme.md): Theme hooks
- [Variants](https://tamagui.dev/docs/core/variants.md): Component variants system

## Compiler

Documentation about Tamagui's optimizing compiler:

- [Compiler Installation](https://tamagui.dev/docs/intro/compiler-install.md): How to install and setup the compiler
- [Why a Compiler?](https://tamagui.dev/docs/intro/why-a-compiler.md): Benefits and reasoning behind the compiler
- [Benchmarks](https://tamagui.dev/docs/intro/benchmarks.md): Performance benchmarks and comparisons

## Components

All component documentation can be accessed at https://tamagui.dev/ui/[component-name]

Available components:

- [Accordion](https://tamagui.dev/ui/accordion.md): Expandable content sections
- [AlertDialog](https://tamagui.dev/ui/alert-dialog.md): Modal dialog for important actions
- [Anchor](https://tamagui.dev/ui/anchor.md): Link component with styling options
- [Avatar](https://tamagui.dev/ui/avatar.md): User avatar display component
- [Button](https://tamagui.dev/ui/button.md): A customizable button component with variants and themes
- [Card](https://tamagui.dev/ui/card.md): Container component for grouped content
- [Checkbox](https://tamagui.dev/ui/checkbox.md): Selection control component
- [Dialog](https://tamagui.dev/ui/dialog.md): Modal dialog component
- [Form](https://tamagui.dev/ui/form.md): Form components and validation
- [Group](https://tamagui.dev/ui/group.md): Component grouping utilities
- [Headings](https://tamagui.dev/ui/headings.md): Typography heading components
- [HTML Elements](https://tamagui.dev/ui/html-elements.md): Basic HTML element components
- [Image](https://tamagui.dev/ui/image.md): Image display component
- [Inputs](https://tamagui.dev/ui/inputs.md): Text input components
- [Label](https://tamagui.dev/ui/label.md): Accessible label components
- [LinearGradient](https://tamagui.dev/ui/linear-gradient.md): Gradient background component
- [ListItem](https://tamagui.dev/ui/list-item.md): List item component
- [LucideIcons](https://tamagui.dev/ui/lucide-icons.md): Icon component library
- [NewInputs](https://tamagui.dev/ui/new-inputs.md): Enhanced input components
- [Popover](https://tamagui.dev/ui/popover.md): Floating content component
- [Portal](https://tamagui.dev/ui/portal.md): Render content in different DOM locations
- [Progress](https://tamagui.dev/ui/progress.md): Progress indicators
- [RadioGroup](https://tamagui.dev/ui/radio-group.md): Radio button selection group
- [ScrollView](https://tamagui.dev/ui/scroll-view.md): Scrollable container component
- [Select](https://tamagui.dev/ui/select.md): Dropdown selection component
- [Separator](https://tamagui.dev/ui/separator.md): Visual separators
- [Shapes](https://tamagui.dev/ui/shapes.md): Basic shape components
- [Sheet](https://tamagui.dev/ui/sheet.md): Bottom sheet and modal components
- [Slider](https://tamagui.dev/ui/slider.md): Range input components
- [Spinner](https://tamagui.dev/ui/spinner.md): Loading indicator component
- [Stacks](https://tamagui.dev/ui/stacks.md): Layout stack components
- [Switch](https://tamagui.dev/ui/switch.md): Toggle switch components
- [Tabs](https://tamagui.dev/ui/tabs.md): Tabbed interface components
- [TamaguiImage](https://tamagui.dev/ui/tamagui-image.md): Enhanced image component
- [Text](https://tamagui.dev/ui/text.md): Text display component
- [Toast](https://tamagui.dev/ui/toast.md): Notification component
- [ToggleGroup](https://tamagui.dev/ui/toggle-group.md): Group of toggle buttons
- [Tooltip](https://tamagui.dev/ui/tooltip.md): Informational tooltips
- [Unspaced](https://tamagui.dev/ui/unspaced.md): Remove spacing utilities
- [VisuallyHidden](https://tamagui.dev/ui/visually-hidden.md): Hide content visually while keeping it accessible
