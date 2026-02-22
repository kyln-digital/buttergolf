# ButterGolf Monorepo

A monorepo setup for ButterGolf using Turborepo, Next.js (web), and Expo (iOS/Android).

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `web`: a [Next.js](https://nextjs.org/) app for the website
- `mobile`: an [Expo](https://expo.dev/) app for iOS/Android mobile experience
- `@my-scope/ui`: a shared React component library compatible with both web and React Native
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 10.20.0 (managed via package.json "packageManager")

### Installation

1. Clone the repository
2. Install dependencies:

```sh
pnpm install
```

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Development

Run all apps in development mode:

```sh
pnpm dev
```

Run specific apps:

```sh
# Web app only
pnpm dev:web

# Mobile app only
pnpm dev:mobile
```

Or use turbo filters directly:

```sh
# Web app
pnpm turbo dev --filter=web

# Mobile app
pnpm turbo dev --filter=mobile
```

### Build

Build all apps and packages:

```sh
pnpm build
```

Build a specific app:

```sh
pnpm turbo build --filter=web
# or
pnpm turbo build --filter=mobile
```

### Linting & Type Checking

```sh
# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck
```

## Monorepo Setup Details

### Metro Configuration (Expo)

The iOS app uses a custom `metro.config.js` that:

- Watches all files in the monorepo (workspace root)
- Resolves modules from both project and workspace `node_modules`
- Disables hierarchical lookup for consistent resolution
- Uses Turborepo cache when possible

### Shared Packages

The `@my-scope/ui` package is configured to work with both React (web) and React Native (iOS):

- Uses peer dependencies for framework compatibility
- React Native is marked as optional for web-only usage
- Components can be imported in both Next.js and Expo apps

### Turborepo Configuration

The `turbo.json` is configured to:

- Handle both Next.js (`.next/**`) and Expo (`.expo/**`) build outputs
- Support persistent dev servers for both platforms
- Run tasks with proper dependency ordering

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started at [vercel.com](https://vercel.com/signup).

To enable remote caching:

```sh
pnpm turbo login
pnpm turbo link
```

## Design System & Styling

This project uses [Tamagui](https://tamagui.dev) for cross-platform UI components and theming. **Always use theme tokens instead of hardcoded values.**

### Quick Start

```tsx
// ✅ Good - Using theme tokens
<YStack backgroundColor="$bg" padding="$4">
  <Text color="$text" fontSize="$5">Hello</Text>
</YStack>

// ❌ Bad - Hardcoded values
<YStack backgroundColor="#fbfbf9" padding={16}>
  <Text color="#0f1720">Hello</Text>
</YStack>
```

### Documentation

- **[Tamagui Best Practices](./docs/TAMAGUI_BEST_PRACTICES.md)** - Component creation, styling patterns, and token usage
- **[Migration Example](./docs/MIGRATION_EXAMPLE.md)** - Step-by-step guide to migrate from hardcoded values
- **[Usage Audit](./docs/TAMAGUI_USAGE_AUDIT.md)** - Detailed analysis and recommendations
- **[Contributing Guide](./CONTRIBUTING.md)** - Development guidelines

### Run Tamagui Audit

```sh
node scripts/audit-tamagui-usage.js
```

## Database

This project uses Prisma with PostgreSQL. See [docs/AUTH_SETUP_CLERK.md](./docs/AUTH_SETUP_CLERK.md) for full setup.

```sh
# Generate Prisma Client
pnpm db:generate

# Push schema changes (development)
pnpm db:push

# Create migration (production)
pnpm db:migrate:dev --name migration-name

# Open Prisma Studio
pnpm db:studio
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
