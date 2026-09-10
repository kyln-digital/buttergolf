# Operations & CI/CD

## Release Model (merge = deploy)

Canonical source: `AGENTS.md` (root). `CLAUDE.md` imports it via `@AGENTS.md`.

- Vercel's Production Branch is `main`: merging a PR to `main` deploys **straight to production**. There is no separate `production` branch or promotion step (verified 2026-09-10 from the GitHub deployment records: merges to `main` create `Production` deployments; PR pushes create `Preview` deployments).
- Every PR branch gets a Vercel **preview** deploy — verify changes there before merging.
- Merging is the release decision: only when CI is green, the preview has been checked, and a human has asked for it.
- **Migrations are not applied by the build.** `turbo run build` depends on `db:generate` only; `prisma migrate deploy` is a separate, deliberate step: assess migration safety before merging and apply it to production as part of the same release.

## CI (`.github/workflows/ci.yml`)

Triggers: `pull_request` (all) and `push` to `main`, with per-ref concurrency cancel-in-progress. Single `validate` job on Node 22:

1. `pnpm install --frozen-lockfile`
2. `pnpm db:generate` (Prisma client — required before type-check)
3. `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test`

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
- **Database**: `DATABASE_URL`
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
