# ButterGolf — OpenWiki Quickstart

ButterGolf is a cross-platform peer-to-peer marketplace for buying and selling used golf equipment (Vinted-style). It runs on web (Next.js 16) and mobile (Expo) from a shared Turborepo monorepo, with a single Tamagui design system, shared Solito screens, Prisma/PostgreSQL data layer, Clerk auth, Stripe Connect escrow payments, and ShipEngine shipping.

## Tech Stack

| Area     | Technology                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Monorepo | Turborepo + pnpm workspaces (all internal packages use `@buttergolf/` namespace, `workspace:*` protocol) |
| Web      | Next.js 16 (App Router), deployed on Vercel                                                              |
| Mobile   | Expo (iOS/Android), React Navigation + Solito                                                            |
| UI       | Tamagui (cross-platform components, design tokens, themes)                                               |
| Database | Prisma 6 + PostgreSQL (Neon)                                                                             |
| Auth     | Clerk (`@clerk/nextjs` for web, `@clerk/clerk-expo` for mobile)                                          |
| Payments | Stripe Connect — Separate Charges and Transfers with escrow/payment hold                                 |
| Shipping | ShipEngine (UK)                                                                                          |
| Images   | Cloudinary                                                                                               |
| Email    | Resend                                                                                                   |
| Testing  | Vitest                                                                                                   |

## Monorepo Layout

```
buttergolf/
├── apps/
│   ├── web/          # Next.js 16 web app (App Router)
│   └── mobile/       # Expo app (React Navigation + Solito)
├── packages/
│   ├── app/          # Shared Solito screens & business logic (@buttergolf/app)
│   ├── ui/           # Tamagui cross-platform components (@buttergolf/ui)
│   ├── db/           # Prisma client & schema (@buttergolf/db)
│   ├── config/       # Tamagui configuration & brand colors (@buttergolf/config)
│   ├── constants/    # Shared constants: categories, checkout, pricing (@buttergolf/constants)
│   ├── assets/       # Shared images, icons, fonts (@buttergolf/assets)
│   ├── eslint-config/
│   └── typescript-config/
├── docs/             # Existing long-form docs (Stripe, codebase review, etc.)
├── scripts/          # Operational & maintenance scripts
├── tests/            # Vitest unit/integration tests
└── .github/          # CI workflows, design system rules, copilot instructions
```

## Getting Started

```bash
pnpm install
cp .env.example .env        # fill in required secrets (Clerk, Stripe, DB, ShipEngine, Cloudinary, Resend, etc.)
pnpm db:generate            # generate the Prisma client
pnpm dev                    # start all apps
```

App-specific dev servers:

```bash
pnpm dev:web                # Next.js on http://localhost:3000
pnpm dev:mobile             # Expo dev server
pnpm dev:mobile:ios         # Expo iOS simulator
pnpm dev:mobile:android     # Expo Android emulator
```

## Common Commands

```bash
pnpm check           # format + lint + type-check (run before pushing)
pnpm typecheck       # TypeScript across workspace
pnpm lint            # ESLint (runs --fix)
pnpm format          # Prettier
pnpm test            # Vitest + turbo test
pnpm test:watch      # Vitest in watch mode

pnpm db:generate     # generate Prisma client
pnpm db:migrate:dev  # create & apply a migration (development)
pnpm db:studio       # open Prisma Studio
pnpm db:seed         # seed the database
pnpm build           # build all apps
```

## OpenWiki Documentation

- [Architecture & Design System](architecture.md) — Monorepo structure, cross-platform navigation, Solito shared screens, Tamagui config, provider stack
- [Domain & Business Logic](domain.md) — Listings, offers, messaging, orders, shipping, promotions, favourites, seller onboarding
- [Payments & Escrow](payments.md) — Stripe Connect model, payment lifecycle, onboarding, cron jobs, pricing
- [Web App & API](web-api.md) — Next.js App Router pages, API route map, middleware, server actions, key lib utilities
- [Data Model](data-model.md) — Prisma schema: 18 models, 9 enums, relationships, cascade rules
- [Operations & CI/CD](operations.md) — Release model, CI, env vars, Vercel config, scripts, testing

## Existing Long-Form Docs

These docs are still useful — OpenWiki summarizes and links to them rather than duplicating:

- `docs/STRIPE_CONNECT_MODEL.md` — Full payment architecture (escrow, payouts, onboarding)
- `docs/STRIPE_EMBEDDED_ONBOARDING_GUIDE.md` — Embedded Connect onboarding
- `docs/CODEBASE_REVIEW.md` — Full codebase review and findings
- `.github/DESIGN_SYSTEM_RULES.md` — Design system rules and conventions
- `.github/copilot-instructions.md` — Detailed agent/copilot instructions
- `.claude/CLAUDE.md` — Conventions, navigation rules, design system usage

## Key Conventions (Quick Reference)

- **Next.js 16 middleware**: uses `src/proxy.ts`, NOT `src/middleware.ts` (renamed in Next 16+)
- **Never import Tamagui in server components** — causes `createContext` build failures. Use plain `<div>` in server components.
- **Never use `@prisma/client` directly** — use the `@buttergolf/db` package's exported Prisma client
- **Design tokens only** — use semantic tokens (`$primary`, `$text`, `$border`, `$4` for spacing). Never use raw hex values.
- **Use `<Row>` / `<Column>`** from `@buttergolf/ui` (shims over XStack/YStack)
- **Solito navigation, not Expo Router** — routes defined once in `packages/app/src/navigation/routes.ts`
- **Release model**: Vercel deploys `main` straight to production; PR branches get preview deploys. Merging to `main` is the release decision, and migrations are applied separately from the build.

## Requirements

- Node.js 22+
- pnpm 10+ (pinned in `package.json` `packageManager` field)
