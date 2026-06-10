# ButterGolf

ButterGolf is a cross-platform peer-to-peer marketplace for buying and selling used golf equipment (Vinted-style). It runs on web (Next.js) and mobile (Expo) from a shared Turborepo monorepo.

## Architecture

```
buttergolf/
├── apps/
│   ├── web/          # Next.js 16 web app (App Router)
│   └── mobile/       # Expo app (iOS/Android, React Navigation + Solito)
└── packages/
    ├── ui/           # Tamagui cross-platform components (@buttergolf/ui)
    ├── app/          # Shared Solito screens & business logic (@buttergolf/app)
    ├── db/           # Prisma client & schema (@buttergolf/db)
    ├── config/       # Tamagui configuration (@buttergolf/config)
    ├── constants/    # Shared constants (@buttergolf/constants)
    ├── assets/       # Shared assets (@buttergolf/assets)
    ├── eslint-config/      # Shared ESLint config
    └── typescript-config/  # Shared tsconfig bases
```

All internal packages use the `@buttergolf/` namespace and the `workspace:*` protocol.

## Stack

- **Build**: Turborepo + pnpm workspaces
- **UI**: Tamagui (web + native); Tailwind CSS v4 on web
- **Navigation**: Next.js App Router (web), React Navigation + Solito (mobile)
- **Database**: Prisma 6 + PostgreSQL (Neon)
- **Auth**: Clerk
- **Payments**: Stripe Connect (separate charges & transfers with escrow/payment hold)
- **Shipping**: ShipEngine (UK)
- **Images**: Cloudinary

## Requirements

- Node.js 22+
- pnpm 10+ (`packageManager` is pinned in `package.json`)

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in the required secrets
pnpm db:generate            # generate the Prisma client
pnpm dev                    # start all apps
```

App-specific dev servers:

```bash
pnpm dev:web                # Next.js on http://localhost:3000
pnpm dev:mobile             # Expo dev server
```

## Common commands

```bash
pnpm build         # build all apps
pnpm check         # format + lint + type-check (run before pushing)
pnpm typecheck     # TypeScript only
pnpm lint          # ESLint
pnpm format        # Prettier

pnpm db:migrate:dev   # create & apply a migration (development)
pnpm db:studio        # open Prisma Studio
pnpm db:seed          # seed the database
```

## Documentation

- `docs/STRIPE_CONNECT_MODEL.md` — payment architecture (escrow, payouts, onboarding)
- `docs/STRIPE_EMBEDDED_ONBOARDING_GUIDE.md` — embedded Connect onboarding
- `docs/CODEBASE_REVIEW.md` — full codebase review and findings
- `.claude/CLAUDE.md` — conventions and design-system rules

## Environment

See `.env.example` for the full list of required variables (Clerk, Stripe, Database, ShipEngine, Cloudinary, Resend, plus `MOBILE_SESSION_SECRET`, `CRON_SECRET`, and `ADMIN_USER_IDS`).
