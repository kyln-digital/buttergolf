# Operations & CI/CD

## Release Model (merge = deploy)

Canonical source: `AGENTS.md` (root). `CLAUDE.md` imports it via `@AGENTS.md`.

- Vercel's Production Branch is `main`: merging a PR to `main` deploys **straight to production**. There is no separate `production` branch or promotion step (verified 2026-09-10 from the GitHub deployment records: merges to `main` create `Production` deployments; PR pushes create `Preview` deployments).
- Every PR branch gets a Vercel **preview** deploy — verify changes there before merging.
- Merging is the release decision: only when CI is green, the preview has been checked, and a human has asked for it.
- **Migrations are not applied by the build.** `db:generate` is the only database-related prerequisite of `turbo run build` (its other dependency is `^build`, upstream package builds). Apply them with `pnpm db:migrate:deploy`, which reads `DATABASE_URL` from `packages/db/.env` (per `packages/db/prisma.config.ts`); pull the **production** value into that file first with `vercel env pull packages/db/.env --environment=production`, never trusting whatever is already there. **Migrate first, then merge**, so code deploying on merge never meets an un-migrated schema, and keep migrations backwards-compatible with the deployed code (expand, then contract).

## Database (one database, previews included)

`DATABASE_URL` is a **single Vercel variable scoped to `Production, Preview, Development`** — one value, one Neon database, behind production and behind every preview deploy. There is no staging copy, and no environment you can point a migration at without pointing it at production. (Verified 2026-09-10: `vercel env ls --project buttergolf-web` lists one `DATABASE_URL` across all three environments, and independent tables return identical CUIDs from `buttergolf.co.uk` and a preview URL.)

Local development is the exception, and only because it is configured separately: `packages/db/.env.example` ships with the Neon block commented out and a Docker URL active, so a fresh `cp .env.example .env` points at localhost. It points at production the moment anyone runs `vercel env pull` — and since the variable carries the same value in all three Vercel environments, `--environment=development` is production too.

Two consequences, and they are the reason schema work here is delicate:

- **A migration is a production change the moment it is applied**, whatever branch you ran it from.
- **A preview can only be exercised against a schema production already has**, so a schema-changing PR has to apply its migration before its preview means anything. That is safe when the migration is additive and backwards-compatible: production's schema simply runs ahead of its code for a while, which costs nothing. It is not safe when the migration drops or renames a column or tightens a constraint — that breaks the code currently deployed, the instant it lands. Nor is skipping the migration an escape: the preview then 500s on a column Prisma selects but the database doesn't have, which is exactly the `isBrandProcessed` incident on 2026-09-10, where every page reading `product_images` returned a 500 until the field was removed.

Until previews get their own database, work with it rather than round it:

- Keep migrations **additive and backwards-compatible** — expand now, contract in a later release — so a schema that runs ahead of the deployed code is harmless.
- Apply deliberately, close to the merge that needs it: `vercel env pull packages/db/.env --environment=production` then `pnpm db:migrate:deploy`. (An exported `DATABASE_URL` works too — the db tasks declare it in `turbo.json`, which otherwise filters it out of the task environment.) **Migrate first, then merge** (merging deploys to production — see the release model above).
- Check `packages/db/.env` before running anything that writes — `db:migrate:deploy`, `db:push`, `db:seed`, or `prisma migrate reset` (there is no `db:reset` script). A Docker URL there is local; anything pulled from Vercel is production, whichever environment it was pulled from.
- The `migrations` CI job (below) runs against a throwaway container and proves the migrations are _internally_ consistent. It says nothing about whether they have been applied to the live database, and it never connects to it.

**Removing the trap** is a dashboard change on Neon/Vercel, not a code change: enable database branching on the `buttergolf-db` integration so each preview deploy gets its own Neon branch, then narrow the committed `DATABASE_URL` to `Production` only. After that, previews become disposable, CI can apply migrations to a real preview branch, and schema changes stop being production releases.

## CI (`.github/workflows/ci.yml`)

Triggers: `pull_request` (all) and `push` to `main`, with per-ref concurrency cancel-in-progress. Two jobs, both on Node 22.

**`validate` — lint, format & type-check**

1. `pnpm install --frozen-lockfile`
2. `pnpm db:generate` (Prisma client — required before type-check)
3. `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test`

**`migrations` — migrations apply & match the schema**

Runs against a `postgres:16` **service container**, never a real database (see [the database note](#database-one-database-previews-included)):

1. `pnpm db:migrate:deploy` — every migration still applies, in order, to an empty database
2. `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code` — the migrations produce exactly the schema the client is generated from (exit code 2 = drift, and the step prints how to fix it)

The second check is the one that would have caught the `isBrandProcessed` incident on 2026-09-10: a model field shipped whose column the deployed database did not have, so every page reading `product_images` returned a 500. What it cannot check is whether the migrations have been _applied_ to the shared database — nothing automated can, while previews and production point at the same one.

No build or deploy step in CI — Vercel handles deploys from branch activity. There is also an `openwiki-update.yml` workflow (manual dispatch + daily 08:00 UTC, `main` only) that runs an OpenWiki docs update and opens a PR onto `openwiki/update`. `.openwikiignore` excludes secrets and generated/build output and restricts host `execute` during those runs.

## Quality Gates

| Gate                | What runs                                                      |
| ------------------- | -------------------------------------------------------------- |
| `.husky/pre-commit` | `pnpm lint-staged`                                             |
| `.husky/pre-push`   | `pnpm typecheck` (fast local guard; CI runs the full set)      |
| `pnpm check`        | `format` + `lint` + `check-types` — the mandated pre-push gate |

## Testing (Vitest, two layers)

**Root** (`vitest.config.ts`, `tests/`) — pure, dependency-free domain logic, no RN/Next/Prisma bootstrap:

| Test file                            | Covers                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth-utils.test.ts`                 | Auth form validation, password strength, Clerk error mapping                                                                               |
| `categories.test.ts`                 | Category set/slug lookups                                                                                                                  |
| `checkout-session-ownership.test.ts` | Checkout-session BOLA guard                                                                                                                |
| `payment-intent-ownership.test.ts`   | PaymentIntent BOLA guard                                                                                                                   |
| `payment-intent-visibility.test.ts`  | **Source-guard test** — reads `create-payment-intent/route.ts` source and asserts `findFirst` + `isDraft: false` + `user.isDeleted: false` |
| `pricing.test.ts`                    | Listing price bounds (£1–£10,000)                                                                                                          |
| `sell-conditions.test.ts`            | Condition labels/enum mapping                                                                                                              |

**Package-level**: `packages/constants` has its own vitest config testing the canonical fee/shipping math in `checkout.ts` (penny rounding, minimum fee floor, shipping option integrity).

`pnpm test` runs root vitest **then** `turbo run test` (both layers). There are no API/integration/e2e tests — the payment-lifecycle suite is the acknowledged next addition (needs a Stripe mock harness).

## Cron Jobs (Vercel)

Defined in `vercel.json`; all protected by `CRON_SECRET` bearer token (fail closed).

| Endpoint                      | Schedule                 | Purpose                                                                                                                                  |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/cron/release-payments`  | `0 3 * * *` (03:00 UTC)  | Auto-release escrow 14 days post-delivery; drains `PENDING_SELLER_ONBOARDING`; verifies charge not refunded/disputed before transferring |
| `/api/cron/expire-offers`     | `0 6 * * *` (06:00 UTC)  | Expire offers past `expiresAt`                                                                                                           |
| `/api/cron/payment-reminders` | `0 10 * * *` (10:00 UTC) | Payment reminder emails                                                                                                                  |

## Environment Variables

`.env.example` lists required variables (names only). Grouped by service:

- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLERK_PROXY_URL` (prod only)
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET` (separate secret for the Connect webhook)
- **Database**: `DATABASE_URL` (one Neon database for all three environments — see [Database](#database-one-database-previews-included))
- **ShipEngine**: `SHIPENGINE_API_KEY`, `SHIPENGINE_WEBHOOK_SECRET`
- **Cloudinary**: cloud name (public) + API key/secret
- **Resend**: `RESEND_API_KEY`
- **Mobile/Expo**: `EXPO_PUBLIC_*` (Clerk + Stripe publishable keys, merchant identifier, API URL)
- **App-level**: `MOBILE_SESSION_SECRET` (min 32 chars, no fallback), `CRON_SECRET`, `ADMIN_USER_IDS`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_COMING_SOON_ENABLED`, `SITE_URL`

Note: `SENTRY_AUTH_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` appear in `turbo.json`'s build env but not `.env.example` — Sentry and Supabase are wired through their own setup flows.

## Useful Scripts

| Command                     | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `pnpm reset-stripe`         | Reset a user's Stripe Connect onboarding (testing) |
| `pnpm upload:images`        | Seed Cloudinary sample images                      |
| `pnpm optimize:site-images` | Optimize site images (`--dry-run` variant)         |
| `pnpm lighthouse`           | Local perf audits against `lighthouserc.js`        |
| `pnpm db:migrate:deploy`    | Apply migrations to a database (not run by Vercel) |

`scripts/` also contains one-off data-fix and debug scripts (some with **hardcoded user emails/product IDs** — read before running), plus design-system codemods (`migrate-layouts.sh` for XStack→Row, YStack→Column).

## Dependency Management

- **Dependabot** (`.github/dependabot.yml`): monthly, 3 open PRs max, three groups — platform-core (security-only; Tamagui/Expo/RN upgrades are fragile), infrastructure (react/next/prisma/stripe/clerk minor+patch), everything-else. **All semver-major updates are ignored** and handled manually.
- Version pinning is centralized in the **pnpm catalog** (`pnpm-workspace.yaml`) — never bump a version in a single package.json.
- `pnpm check-deps` verifies version consistency across the workspace.

## Known Issues & Technical Debt

`docs/CODEBASE_REVIEW.md` (June 2026) is the canonical audit. Most critical findings were fixed on its branch (payment race conditions, BOLA guards, CI bootstrap). **Deliberately deferred** items worth knowing before you touch these areas:

- **DB-1**: money fields are `Float`, not Int pence (needs a coordinated backfill — see [Data Model](data-model.md))
- **PAY-3**: mobile PaymentSheet shipping collection UX
- **PAY-6**: seller-set `DELIVERED` is not carrier-verified before auto-release (fraud/policy decision)
- **CSP header** absent (needs live testing against Stripe/Clerk/Cloudinary)
- Web perf refactors (WEB-6/8/9/10) rated Medium/Low
