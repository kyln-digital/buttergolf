# Architecture & Design System

## Monorepo Overview

ButterGolf is a Turborepo + pnpm workspace monorepo with two deployable apps and six shared packages. All internal packages use the `@buttergolf/` namespace and `workspace:*` protocol.

| App/Package             | Path                  | Purpose                                                             |
| ----------------------- | --------------------- | ------------------------------------------------------------------- |
| Web                     | `apps/web/`           | Next.js 16 App Router, deployed on Vercel                           |
| Mobile                  | `apps/mobile/`        | Expo app (iOS/Android), React Navigation + Solito                   |
| `@buttergolf/app`       | `packages/app/`       | Shared Solito screens, navigation routes, business logic            |
| `@buttergolf/ui`        | `packages/ui/`        | Tamagui cross-platform component library                            |
| `@buttergolf/db`        | `packages/db/`        | Prisma client, schema, migrations, seeders                          |
| `@buttergolf/config`    | `packages/config/`    | Tamagui config: tokens, themes, fonts, animations, brand colors     |
| `@buttergolf/constants` | `packages/constants/` | Zero-dependency constants: categories, checkout, pricing, error IDs |
| `@buttergolf/assets`    | `packages/assets/`    | Shared images, SVG icons, fonts                                     |

Turbo orchestration (`turbo.json`) defines tasks: `build`, `dev`, `lint`, `check-types`, `test`, `db:generate`, `db:migrate:dev`, `db:push`, `db:studio`, `db:seed`. The `build` task depends on `^build` and `db:generate`. `db:push` is a Turbo task only — schema changes must go through `db:migrate:dev`; `db:push` causes migration drift and is forbidden.

## Cross-Platform Navigation (Solito, Not Expo Router)

This is a **Solito-based monorepo**, not Expo Router. Navigation works as follows:

- **Web**: Next.js App Router (file-based routing in `apps/web/src/app/`)
- **Mobile**: Expo + React Navigation (manual route registration in `apps/mobile/App.tsx`)
- **Shared**: Solito translates between platforms automatically

### Route Definition

All routes are defined once as string constants in `packages/app/src/navigation/routes.ts` (e.g. `home: "/"`, `productDetail: "/products/[id]"`). This is the single source of truth:

- Web reads the route paths implicitly via Next.js file-based routing
- Mobile derives its React Navigation `linking` config from the same `routes` object, keeping deep links in sync

### Adding a New Screen

1. Define the route in `packages/app/src/navigation/routes.ts`
2. Create the screen in `packages/app/src/features/[feature]/[screen-name].tsx` — must be platform-agnostic (use Tamagui, no web/native-specific APIs)
3. Export from `packages/app/src/index.ts`
4. **Web (automatic)**: Create matching route in `apps/web/src/app/[route]/page.tsx`
5. **Mobile (manual)**: Register in `apps/mobile/App.tsx` — both in the `linking` config AND the `<Stack.Navigator>`

### Common Navigation Mistakes

- Don't expect Expo Router file-based routing in `apps/mobile/`
- Don't create separate screens for web and mobile
- Don't forget to register new routes in BOTH linking config AND Stack Navigator
- Don't use Next.js-specific APIs in `packages/app/`
- Use Solito's `useLink` and `Link` components
- Pass data-fetching functions as callback props (not direct API calls)

## Shared Screen Pattern

Shared screens in `packages/app/src/features/` are **platform-agnostic "dumb" components**. They accept callback props for all side effects (data fetching, navigation, auth, checkout). Each platform's host app creates wrapper components that wire those callbacks to platform-specific implementations.

**Example**: `ProductDetailScreen` (`packages/app/src/features/products/detail-screen.tsx`) accepts `onFetchProduct`, `onBuyNow`, `onMakeOffer`, `onToggleFavourite` as props. On mobile, `apps/mobile/App.tsx` wraps it in a `ProductDetailScreenWrapper` that injects `apps/mobile/lib/apiClient.ts` for fetching and `apps/mobile/lib/wrapperActions.ts` for checkout. On web, the Next.js page wires server-side fetching and Stripe.js checkout.

### Feature Areas in `packages/app/src/features/`

| Feature       | Key Screens                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| `home/`       | `HomeScreen` — hero, category grid, search, buy/sell toggle                            |
| `products/`   | `detail-screen.tsx`, `list-screen.tsx`                                                 |
| `sell/`       | `sell-screen.tsx`, `DetailsStep.tsx`                                                   |
| `orders/`     | `orders-screen.tsx`, `order-detail-screen.tsx`                                         |
| `messages/`   | `messages-screen.tsx`, `message-thread-screen.tsx`                                     |
| `seller/`     | `seller-dashboard-screen.tsx`, `seller-listings-screen.tsx`, `seller-sales-screen.tsx` |
| `account/`    | `addresses-screen.tsx`, `notifications-settings-screen.tsx`                            |
| `categories/` | `category-list-screen.tsx`                                                             |
| `favourites/` | favourites screen                                                                      |
| `rounds/`     | `screen.tsx`                                                                           |
| `onboarding/` | `screen.tsx` (mobile Stripe onboarding gate)                                           |

The auth screens (SignIn, SignUp, VerifyEmail, ForgotPassword, ResetPassword, TwoFactor) are not shared: they are built on `@clerk/clerk-expo`, so they live in `apps/mobile/features/auth/`. Web uses Clerk's prebuilt `<SignIn/>` / `<SignUp/>` from `@clerk/nextjs` instead.

### Provider Stack

**Mobile** (`apps/mobile/App.tsx`):
`SafeAreaProvider` → `SafeStripeProvider` → `ClerkProvider` → `PortalProvider` → `Provider` (wraps `TamaguiProvider` with shared config) → `ClerkLoaded` → `SignedIn`/`SignedOut` → `SellerStatusProvider` → `NavigationContainer` → `Stack.Navigator`

**Web** (`apps/web/src/app/layout.tsx` + `NextTamaguiProvider.tsx`):
Uses `NextThemeProvider` from `@tamagui/next-theme` for SSR-safe theme switching, CSS injection, and system preference detection. The `Provider` from `@buttergolf/app` deliberately avoids `useColorScheme()` to prevent SSR hydration mismatches.

### Cross-Platform Hooks

`packages/app/src/hooks/useTheme.ts` defines the `UseThemeResult` interface with platform-specific implementations:

- `useTheme.native.ts` — uses React Native `useColorScheme`, `canToggle: false`
- `useTheme.web.ts` — uses `@tamagui/next-theme`'s `useThemeSetting`, `canToggle: true`

Bundlers resolve the correct variant automatically. Also exports `useMobileFavourites` and `useSellerStatus`.

## Tamagui Design System

### Config (`packages/config/src/tamagui.config.ts`)

The single Tamagui configuration shared by both web (Next.js plugin) and mobile (Babel plugin). Extends `@tamagui/config/v4`'s `defaultConfig`.

Key elements:

- **Fonts**: Urbanist typeface (weights 100–900), separate `headingFont` and `bodyFont` via `createFont()` with explicit pixel `size` ($1–$16) and `lineHeight` scales
- **Tokens** (`createTokens`): Brand colors from `brandColors`, plus semantic aliases (`primary`, `secondary`, `success`, `error`, `warning`, `info`, `background`, `text`, `border`, etc.)
- **Themes**: Four themes — `light`, `dark`, `light_active`, `dark_active`. Dark theme inverts backgrounds/text and adjusts card elevation.
- **Media queries**: `xs`–`xxl` (max-width), `gtXs`–`gtXxl` (min-width), `short`/`tall` (height), `hoverNone`/`pointerCoarse`
- **Animations**: Platform-specific — web uses `@tamagui/animations-css`, mobile uses `@tamagui/animations-react-native` (spring physics). Metro auto-resolves `.native.ts`.

### Brand Colors (`packages/config/src/brand-colors.ts`)

Dependency-free module defining all brand color hex values. This is the **single source of truth** for brand colors across the monorepo. Exported for non-Tamagui consumers (React Navigation themes, Stripe appearance, WebView styles).

| Token             | Hex       | Usage                          |
| ----------------- | --------- | ------------------------------ |
| Spiced Clementine | `#F45314` | Primary brand color            |
| Vanilla Cream     | `#FFFAD2` | Light backgrounds              |
| Lemon Haze        | `#EDECC3` | Subtle accent                  |
| Burnt Olive       | `#3E3B2C` | Dark accent / secondary        |
| Cloud Mist        | `#EDEDED` | Borders/dividers               |
| Slate Smoke       | `#545454` | Secondary text                 |
| Ironstone         | `#323232` | Primary text / dark background |
| Pure White        | `#FFFFFF` | Base white                     |

### UI Components (`packages/ui/src/index.ts`)

The barrel is **curated** — it re-exports only the design-system surface consumers should use (plus pass-throughs of `Theme`, `Separator`, `useTheme`, `useMedia` from `tamagui`). ESLint blocks direct `tamagui` component imports (`packages/eslint-config/react-internal.js`). Roughly 30 components built on Tamagui's `styled()` API:

| Category   | Components                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Buttons    | `Button` (with `butterVariant`: primary/secondary/icon), `BuySellToggle`                                    |
| Typography | `Text`, `Heading`, `Label` (native `fontWeight`/`textAlign` props — no custom weight/align variants)        |
| Layout     | `Row`, `Column`, `Container`, `Spacer`, `XStack`, `YStack`, `View`                                          |
| Cards      | `Card` (compound: `.Header`, `.Body`, `.Footer`), `GlassmorphismCard`                                       |
| Forms      | `Input`, `TextArea`, `Radio`/`RadioGroup`, `Autocomplete`, `Checkbox`, `Slider`, `Switch`/`SwitchWithLabel` |
| Feedback   | `Badge`, `Spinner`                                                                                          |
| Navigation | `SegmentedTabs`, `CategorySelector`                                                                         |
| Media      | `Image`, `ScrollView`                                                                                       |
| Overlays   | `Sheet`/`SheetScrollView`, `Popover` (compound)                                                             |
| Chat       | `ChatInput`, `ChatMessageList`, `ConversationListItem`                                                      |
| Theme      | `ThemeSwitcher`, `ThemeToggleButton`                                                                        |
| Error      | `ErrorBoundary`                                                                                             |

### Critical UI Rules

- **Never import Tamagui in server components** — Tamagui uses `React.createContext()` at module load time, which breaks during Next.js "Collecting page data" phase. Use plain `<div>` in server components.
- **Design tokens only** — use semantic tokens (`$primary`, `$text`, `$border`, `$4` for spacing). Never use raw hex values or pixel values. `fontSize` on `<Text>` is ESLint-blocked — use `size="$4"` instead.
- **Use `<Row>` / `<Column>`** (shims over XStack/YStack) with native Tamagui props (`alignItems`, `justifyContent`, `gap="$md"`). No custom `align=`/`justify=` variants.
- **Prefer semantic tokens** (`$text`, `$background`, `$surface`, `$card`, `$border`, `$success`, `$error`) for theme support. Use brand tokens (`$ironstone`, `$spicedClementine`) sparingly, only in component libraries.
- Import from `@buttergolf/ui` instead of direct `tamagui` imports.

## Mobile App (`apps/mobile/`)

- **Entry**: `apps/mobile/index.ts` registers `App.tsx` via `registerRootComponent`
- **Metro config** (`metro.config.js`): Monorepo-aware, watches entire monorepo root, forces singleton resolution for `react`, `react-native`, `tamagui`, `@tamagui/core`, etc. Uses `react-native-svg-transformer` for SVG support.
- **Babel config**: `babel-preset-expo`, `module-resolver` to alias `@buttergolf/ui` directly to `packages/ui/src`, `@tamagui/babel-plugin` pointing at `packages/config/src/tamagui.config.ts`
- **App config** (`app.json`): App name "Buttergolf", bundle ID `com.buttergolf.app`, deep-link scheme `buttergolf://`, universal links for `buttergolf.com`, Expo Updates enabled, new architecture enabled

### Mobile-Only Files

| File                                             | Purpose                                                         |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `apps/mobile/lib/apiClient.ts`                   | Deferred fetch helpers with secure-store token injection        |
| `apps/mobile/lib/wrapperActions.ts`              | Stripe onboarding, label actions, checkout flow hooks           |
| `apps/mobile/lib/notifications.ts`               | expo-notifications registration + backend sync                  |
| `apps/mobile/lib/secureStore.ts`                 | Expo SecureStore wrapper for auth tokens                        |
| `apps/mobile/lib/stripe-safe.tsx`                | Graceful Stripe provider for Expo Go                            |
| `apps/mobile/context/SellerStatusContext.tsx`    | Fetches seller status once on sign-in; shared via React context |
| `apps/mobile/components/MobileCheckoutSheet.tsx` | Native bottom-sheet checkout UI                                 |

## Shared Constants (`packages/constants/`)

Zero-dependency, Prisma-free constants safe for import in React Native, web, and server. Tested with Vitest.

| File            | Contents                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories.ts` | `CATEGORIES` array (9 golf product categories with slug, description, image URL, sort order), `getCategoryBySlug()`                                                                                     |
| `checkout.ts`   | `SHIPPING_OPTIONS` (Standard/Express/NextDay with pence pricing), `calculateBuyerProtectionFeeInPence` (5% + £0.70, min £0.70). Canonical functions used by both server charge math and client display. |
| `pricing.ts`    | `LISTING_PRICE_LIMITS` (GBP 1–10,000), `getListingPriceBoundsMessage()`                                                                                                                                 |
| `errorIds.ts`   | Structured error ID constants for Sentry grouping                                                                                                                                                       |
| `logging.ts`    | `logError()`, `logDebug()`, `logWarning()` with structured `LogContext`                                                                                                                                 |
| `images.ts`     | `PLACEHOLDER_IMAGE_URL`, `PRODUCT_IMAGE_ASPECT_RATIO` (4:3)                                                                                                                                             |

## Build & Tooling

- **Turborepo** orchestrates all tasks with caching. `build` depends on `^build` + `db:generate`.
- **pnpm catalog** (`pnpm-workspace.yaml`): Centralized version pinning for all shared dependencies (React 19.2.4, Next 16.2.10, Tamagui 1.144.3, Prisma 6.19.2, etc.) — never bump a version in a single package.json
- **TypeScript**: Strict mode, shared base configs in `packages/typescript-config/`
- **ESLint**: Shared config in `packages/eslint-config/`
- **Prettier**: Configured at root; `.prettierignore` excludes `pnpm-lock.yaml`
- **Husky**: `pre-push` hook runs `pnpm typecheck` (fast local guard — CI runs the full lint/format/typecheck set; see [Operations](operations.md))
