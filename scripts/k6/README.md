# ButterGolf k6 Suite

This suite load-tests the Next.js web app over HTTP. It is staging-first and keeps mutating flows behind explicit flags so smoke/load checks can run without creating marketplace data.

## What It Covers

- Public pages and discovery APIs: home, listings, category pages, product detail, search, categories, brands, models, recent products, sitemap.
- Protected marketplace reads: orders, conversations, messages, favourites, addresses, seller listings, seller status.
- Negative auth probes: protected APIs must return `401` without auth.
- Opt-in writes: products, drafts, favourites, addresses, conversations, messages, offers, checkout API creation, shipping, and uploads.
- Opt-in webhooks: Clerk, Stripe payment, Stripe Connect, and ShipEngine signature checks.

Lighthouse remains the browser/Core Web Vitals lane. k6 owns server/API latency, throughput, and resilience.

## Prerequisites

Install k6 locally or in your runner:

```bash
brew install k6
```

Point the suite at a seeded staging app:

```bash
export K6_BASE_URL=https://your-staging-url.example.com
export K6_STAGE=staging
export K6_MOBILE_SESSION_SECRET=the-same-secret-used-by-apps-web
```

The mobile session secret must match the app runtime. The web app validates these Bearer tokens in [apps/web/src/lib/auth.ts](../../apps/web/src/lib/auth.ts), using the token shape from [apps/web/src/lib/mobile-session.ts](../../apps/web/src/lib/mobile-session.ts).

## Common Runs

```bash
pnpm perf:k6:smoke
pnpm perf:k6:load
pnpm perf:k6:spike
pnpm perf:k6:stress
pnpm perf:k6:soak
```

Write-heavy runs are explicit:

```bash
K6_ENABLE_WRITES=true pnpm perf:k6:writes
```

External-service write paths are extra flags:

```bash
K6_ENABLE_WRITES=true K6_ENABLE_STRIPE=true pnpm perf:k6:writes
K6_ENABLE_WRITES=true K6_ENABLE_SHIPPING=true pnpm perf:k6:writes
K6_ENABLE_WRITES=true K6_ENABLE_UPLOADS=true pnpm perf:k6:writes
```

Webhook checks require staging webhook secrets:

```bash
K6_ENABLE_WEBHOOKS=true \
K6_CLERK_WEBHOOK_SECRET=... \
K6_STRIPE_WEBHOOK_SECRET=... \
K6_STRIPE_CONNECT_WEBHOOK_SECRET=... \
K6_SHIPENGINE_WEBHOOK_SECRET=... \
pnpm perf:k6:webhooks
```

## Safety

Mutating profiles refuse to run against `https://www.buttergolf.com` unless `K6_ALLOW_PRODUCTION_WRITES=true` is set. Treat that flag as a release-manager-only emergency switch.

Created listings are tagged in their title and request IDs with `k6-...`, making staging cleanup straightforward.

## Fixtures

Setup discovers fixtures through APIs:

- `/api/categories`
- `/api/brands`
- `/api/listings`
- `/api/products/recent`
- `/api/conversations`
- `/api/orders`
- `/api/seller/listings`

You can pin specific staging records when needed:

```bash
export K6_PRODUCT_ID=...
export K6_CONVERSATION_ID=...
export K6_ORDER_ID=...
```

The default seeded users come from [packages/db/prisma/seed.ts](../../packages/db/prisma/seed.ts): Emma as buyer, Sarah as seller, and Mike as second buyer. Override their Clerk IDs with `K6_BUYER_CLERK_ID`, `K6_SELLER_CLERK_ID`, and `K6_SECOND_BUYER_CLERK_ID` if staging uses real Clerk test users.

## Results

Every run writes summaries to `scripts/k6/results/`:

- `*.json` full k6 summary data
- `*.md` concise run summary

The directory is ignored except for `.gitkeep`.

## Thresholds

Initial thresholds are intentionally conservative:

- Public APIs: lower p95 and p99 budgets.
- Protected APIs: moderate budgets.
- Writes and external service calls: looser budgets.
- Webhooks: low latency and low failure budget.

After several staging runs, tighten thresholds around observed p95/p99 values before adding CI enforcement.

## CI Handoff

Start with manual staging runs. Once thresholds are stable, add a scheduled or manually dispatched CI workflow for `pnpm perf:k6:smoke`, then graduate read-only `pnpm perf:k6:load` to nightly staging.
