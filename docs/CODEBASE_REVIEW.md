# ButterGolf — Full Codebase Review

**Date:** 9 June 2026
**Scope:** Entire monorepo — `apps/web`, `apps/mobile`, `packages/*`, database schema, tooling, CI/CD
**Method:** Static review of all major code paths (payments, auth/security, web quality, mobile + shared packages, data model + infra), grounded by running the repo's own quality gates.

---

## 1. Executive summary

ButterGolf is a well-architected monorepo with genuinely strong foundations: the cross-platform Solito/Tamagui screen-sharing works as designed, the project's hardest self-imposed rules (no Tamagui in server components, no direct `@prisma/client` imports, design-token discipline) are followed almost without exception, and the most dangerous code — the Stripe escrow — shows real care (signature verification everywhere, idempotency keys, atomic claim-and-release in the cron, `source_transaction`-linked transfers).

The risk is concentrated in three places:

1. **Money-flow edge cases (Critical).** The escrow state machine has unreachable states: refunds and disputes never set `paymentHoldStatus`, so the auto-release cron can pay a seller _after_ the buyer was refunded. The Connect-webhook payout drain has no idempotency key and an ineffective lock, and is invoked by 4+ near-simultaneous Stripe events per onboarding. Mobile purchases never attach shipping to the PaymentIntent, so every mobile sale charges the buyer and silently fails to create an order. Products can be double-sold because availability is only checked at intent creation.
2. **A handful of auth gaps in an otherwise consistent posture (Critical/High).** The mobile-session JWT secret falls back to a hardcoded string; a server action accepts an arbitrary `clerkId`; one order-lookup route returns buyer shipping addresses unauthenticated; debug endpoints ship to production.
3. **Zero safety net.** There are no tests, no CI workflows, pre-push hooks are disabled, and the repo's own mandated gate (`pnpm check`) fails at HEAD (type error + Prettier on generated files). Every finding above reached `main` unchecked by anything.

**Health scorecard**

| Area                    | Grade             | Summary                                                                                           |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| Architecture & monorepo | 🟢 Strong         | Clean package boundaries, single-source routes, current deps, thoughtful tooling                  |
| Payments correctness    | 🔴 At risk        | 4 critical defects: refund/release race, duplicate-payout paths, mobile order loss, double-sell   |
| Security & auth         | 🟡 Mostly solid   | Consistent IDOR enforcement and webhook verification; 2 critical + 3 high gaps                    |
| Data model              | 🟡 Mixed          | Money as `Float`, soft-delete never read, drafts public, missing unique constraints               |
| Web app quality         | 🟡 Good with debt | Core rules respected; SEO missing on product pages, no error boundaries, force-dynamic everywhere |
| Mobile app quality      | 🟡 Good with debt | Clean shared screens; 2,609-line App.tsx, push/SSE lifecycle bugs, infinite refetch loop          |
| Quality infrastructure  | 🔴 Absent         | No tests, no CI, pre-push disabled, `pnpm check` red at HEAD                                      |
| Documentation           | 🟠 Stale          | CLAUDE.md describes the pre-pivot product; README is template boilerplate; dead doc links         |

---

## 2. Baseline validation (what actually runs today)

| Check                     | Result                | Notes                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`            | ✅ Pass               | Clean install, Prisma client generated via postinstall                                                                                                                                                                                                                              |
| `pnpm typecheck`          | ❌ **Fail**           | `web#check-types` fails: `packages/assets/src/icons.ts` — TS2307 `Cannot find module '../icons/golfball.svg'` (×4). The `svg.d.ts` ambient declaration exists at `packages/assets/types/svg.d.ts` but is not included by the web `tsconfig`. Mobile passes.                         |
| `pnpm lint`               | ✅ Pass (12 warnings) | Raw `<img>` in `HeroRedesign.tsx` (×4), unescaped entities, `APP_URL` undeclared in `turbo.json`, missing `jsx-a11y` rule definition. Note: both lint scripts run `eslint --fix` — a "lint" that mutates source.                                                                    |
| `pnpm format:check`       | ❌ **Fail**           | Prettier flags `packages/db/generated/client/*.d.ts` — generated Prisma output is not in `.prettierignore`, so `pnpm check` (the repo's REQUIRED validation command) fails on generated code.                                                                                       |
| `pnpm build --filter=web` | ⚠️ Env-blocked        | Compilation succeeded; build failed only at `next/font` fetching Urbanist from Google Fonts (sandbox TLS proxy: "self-signed certificate in certificate chain"). Not a code defect — but note the build has a hard runtime dependency on Google Fonts (consider `next/font/local`). |
| Secret scan               | ✅ Clean              | No live keys committed; only `sk_test_...` placeholders in docs. No `.env` files tracked.                                                                                                                                                                                           |

**Headline:** the repo's own mandated quality gate (`pnpm check`) **fails at HEAD** — and since there are **no tests and no CI**, nothing would have caught it.

---

## 3. Findings

### 3.1 Security & authentication

#### 🔴 Critical

**SEC-1 — Mobile-session JWT secret has dangerous fallbacks** — `apps/web/src/lib/mobile-session.ts:5-10`
The HS256 secret used to sign/verify mobile session tokens falls back to (a) the first 32 chars of `STRIPE_SECRET_KEY`, then (b) the hardcoded string `"dev-secret-key-minimum-32-chars!"`. If `MOBILE_SESSION_SECRET` is unset in any environment, anyone can forge a token for any Clerk user ID and fully impersonate them across every `getUserIdFromRequest`-protected route (orders, addresses, messages, uploads, Stripe onboarding). Deriving an auth-signing key from the Stripe secret is also secret-reuse.
**Fix:** require `MOBILE_SESSION_SECRET` (throw at startup if missing); remove both fallbacks; rotate.

**SEC-2 — `getMyProducts` server action accepts arbitrary `clerkId`** — `apps/web/src/app/actions/products.ts:100`
`"use server"` actions are public POST endpoints. This one takes a caller-supplied `clerkId` with zero auth check, letting anyone enumerate another user's active listing set keyed to their identity. Impact is bounded (listings are semi-public, drafts filtered) but the pattern is a broken-auth template waiting to be copied.
**Fix:** derive the user from `await auth()` inside the action; drop the parameter.

#### 🟠 High

**SEC-3 — `/api/orders/by-session/[sessionId]` is unauthenticated and leaks buyer PII** — `apps/web/src/app/api/orders/by-session/[sessionId]/route.ts:9-102`
No auth, no ownership check; returns the buyer's full shipping address, amounts, seller identity and tracking. Stripe `cs_…` IDs are high-entropy but routinely leak via success-page URLs, browser history, referrers and analytics. (The sibling `by-payment-intent` route does this correctly — auth + buyer/seller ownership.)
**Fix:** mirror `by-payment-intent`: authenticate and require `buyerId`/`sellerId` match.

**SEC-4 — Debug/test endpoints live in production** — `apps/web/src/app/api/debug-clerk/route.ts`, `apps/web/src/app/api/sentry-example-api/route.ts`
`debug-clerk` echoes the caller's full session claims (reconnaissance value); both should not be deployed.
**Fix:** delete both routes.

**SEC-5 — `/api/shipping/calculate` is unauthenticated, unlimited, and proxies a paid API** — `apps/web/src/app/api/shipping/calculate/route.ts:9-43`
POST forwards the raw body to ShipEngine with no auth or rate limit — cost-abuse vector plus product-existence oracle; error messages pass through to the client.
**Fix:** add `checkRateLimit`, consider auth, return generic errors.

#### 🟡 Medium

- **SEC-6 — Global CORS reflection**: `proxy.ts:56-73` reflects any `Origin` (or `*`) for all API preflights; only `/api/upload` has a real allowlist. Reuse the `ALLOWED_ORIGINS` allowlist in the middleware.
- **SEC-7 — Rate limiting gaps**: `checkRateLimit` exists (`src/middleware/rate-limit.ts`) but is used on only 6 routes. Missing on `/api/waitlist`, `/api/shipping/calculate`, `/api/upload` (Cloudinary + background-removal billing), `/api/checkout/create-payment-intent`, `/api/promotions/purchase`. Limiter is in-memory per instance (acceptable now, weak at scale).
- **SEC-8 — Error responses leak internals**: `details: error.message` returned to clients in `users/seller-status/route.ts:220`, `stripe/connect/mobile-onboard/route.ts:199`, `mobile-session/route.ts:105`, `checkout/create-payment-intent/route.ts:160`, `shipping/calculate`. Log server-side, return generic message.
- **SEC-9 — Hardcoded admin IDs + verbose auth logging in middleware**: `proxy.ts` carries 9 hardcoded admin user IDs for the coming-soon bypass and logs Authorization-header metadata per request. Move IDs to env; remove debug logging at launch.

#### 🟢 Low

- View counter on `/api/products/[id]` is trivially inflatable (no auth/limit) — integrity only.

#### Refuted risks (checked and OK)

- `by-payment-intent` route **is** properly secured (auth + ownership).
- `user/phone`, `users/push-tokens`, `users/seller-status`, `stripe/connect/mobile-onboard` all authenticate and self-scope.
- Clerk Bearer tokens are genuinely signature-verified via Clerk's SDK.
- All 5 webhooks (Stripe ×2, Clerk/svix, EasyPost, ShipEngine) verify signatures.
- No raw SQL, no SSRF, no user-data XSS sinks (all 3 `dangerouslySetInnerHTML` uses are static CSS/JSON-LD), no committed secrets.

### 3.2 Data model & infrastructure

#### 🔴 Critical

**DB-1 — Every money field is `Float`** — `packages/db/prisma/schema.prisma`
All ten monetary fields use IEEE-754 floats: `Product.price` (L101), `Order.amountTotal`/`shippingCost`/`stripePlatformFee`/`stripeSellerPayout`/`buyerProtectionFee` (L197-236), `Message.offerAmount` (L262), `Offer.amount` (L299), `CounterOffer.amount` (L326), `ProductPromotion.amountPaid` (L366). Float pounds are round-tripped through `*100`/`/100` on every escrow transfer, and the fee split is stored as three independently-rounded floats — classic penny-drift. The seller transfer is computed from the stored Float, not Stripe's integer amount.
**Fix:** migrate to `Int` pence (matches Stripe's native unit and the existing conversions).

#### 🟠 High

**DB-2 — Soft delete is written but never read** — schema L27-28; only writer `api/clerk/webhook/route.ts:157-158`
No query anywhere filters `isDeleted`; no Prisma client extension enforces it. Products, ratings and conversations of Clerk-deleted users remain publicly visible and purchasable.
**Fix:** filter `user: { isDeleted: false }` in all public read paths (ideally a client extension); mark a deleted user's live products unavailable.

**DB-3 — Draft products appear in public listings** — `apps/web/src/app/listings/page.tsx`, `api/listings/route.ts`, `category/[slug]/page.tsx`
`isDraft` (schema L107) is never filtered in the public read paths; incomplete sell-flow drafts render publicly.

**DB-4 — Cascade deletes can destroy financial records** — schema L311-314, L332, L372-373
`ProductPromotion` (a paid record with `stripePaymentId`) cascades from product and user; accepted `Offer`s (which determine sale price) cascade too. Meanwhile `Order` relations default to `Restrict`, so user hard-deletes fail unpredictably depending on sales history.
**Fix:** `Restrict` for promotions/offers tied to orders; make soft delete the only user-deletion path.

**DB-5 — Missing idempotency-critical unique constraints**

- `ProductPromotion.stripePaymentId` not unique (L365) — webhook retry can duplicate paid promotions (contrast `Order.stripePaymentId @unique`, done right).
- `Product.requestId` indexed but not unique (L118, L139) — the check-then-create in `api/products/route.ts` is a TOCTOU race under concurrent retries. **Fix:** `@@unique([userId, requestId])` + catch `P2002`.
- `Order.stripeCheckoutId` / `stripeChargeId` not unique (Medium).

#### 🟡 Medium

- **DB-6 — Missing composite indexes**: `orders @@index([buyerId, status])` / `([sellerId, status])`; `products @@index([categoryId, isSold])`; `messages @@index([conversationId, createdAt])`.
- **DB-7 — Stringly-typed state**: `User.stripeAccountStatus`, `Order.stripePayoutStatus` (a magic-string bug here already required the `fix-payment-hold-status.ts` repair script), `labelFormat`, `woodsSubcategory`; `SellerRating.rating` unbounded; `stripeRequirementsDue Json?` hides structure.
- **DB-8 — Migration hygiene**: runtime repair script `fix-payment-hold-status.ts` lives inside `prisma/migrations/` (not a migration, untracked by Prisma — move to `scripts/`); `DELETE FROM messages` hidden in `20260223110617_add_conversation_model`; `DROP TABLE favorites` hidden in a migration named `add_waitlist_table`.
- **INF-1 — Security headers incomplete** (`vercel.json:18-36`): no HSTS, no CSP, no Permissions-Policy — notable for a payments site.
- **INF-2 — No CI, pre-push disabled**: `.github/workflows/` has no workflows; `.husky/pre-push` is `exit 0`. Only lint-staged on commit. Combined with zero tests, nothing gates merges.
- **INF-3 — Env-var drift**: 14+ vars referenced in code but missing from `.env.example` (incl. `CRON_SECRET`, `MOBILE_SESSION_SECRET`, `RESEND_API_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET`, Supabase vars); EasyPost marked "deprecated" in `.env.example` but still referenced in code; four competing URL-base vars (`SITE_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`); turbo.json `build.env` declares only half the `NEXT_PUBLIC_*` set.
- **DOC-1 — Documentation materially wrong**: `.claude/CLAUDE.md` describes a "course booking" app (the booking tables were dropped in migration `20251105153459` — this is a P2P equipment marketplace) and links three docs that don't exist; `packages/db/.claude/CLAUDE.md` documents non-existent Course/Hole/Booking models and a `db` export that's actually `prisma`; `README.md` is a stale Turborepo template (`@my-scope/ui`, `@repo/*`).

#### 🟢 Low

- **INF-4 — Repo clutter (committed)**: ~4.2 MB Lighthouse artifacts at root, vendored docs (`popover.md`, `prisma-upgrade.md`), 61 KB `database-info.md`, `Stripe-embedded-onboarding-guide.md` (move to `docs/`), agent scratchpad `memory/`, `.expo/` committed at root with no `.gitignore` entry, one-off debug scripts in `scripts/`.
- **INF-5 — `packages/db/src/index.ts` nits**: throwing Proxy breaks `await prisma`-style access with a confusing error; `export * from "@buttergolf/constants"` couples unrelated packages; `OrderStatus`/`ShipmentStatus`/`ClubKind` exported type-only while other enums are runtime values.
- **INF-6 — turbo.json**: `db:generate` declares `inputs` on an uncached task (dead config).

#### Done well (data/infra)

- Duplicate-transfer protection is solid across all three payout paths (`stripeTransferId` null-guards via conditional `updateMany` + Stripe idempotency keys).
- Key unique constraints exist where it matters most: `Order.stripePaymentId`, `Favourite (userId, productId)`, `SellerRating.orderId`, `Conversation (productId, buyerId, sellerId)`.
- Linear migration history, lock file committed; thoughtful dependabot config; custom Prisma output + RN stub cleanly solves the pnpm/Expo problem.

---

### 3.3 Web application quality (`apps/web`)

**Stats:** 39 pages + 5 layouts (19 client / 20 server components); ~22k TSX lines under `src/app`; 21 files force `dynamic = "force-dynamic"` including the root layout; 1 `loading.tsx`, **0 `error.tsx`**, **0 `not-found.tsx`**; `generateMetadata` on exactly 1 route.

#### 🟠 High

**WEB-1 — Draft listings leak publicly + into the sitemap** (overlaps DB-3)
`listings/page.tsx:28-32`, `category/[slug]/page.tsx:39-44`, `products/[id]/page.tsx:15` (drafts directly viewable by ID), and `server-sitemap.xml/route.ts:14-17` (drafts get indexed by Google) all filter only `isSold: false`. **Fix:** add `isDraft: false` everywhere public (incl. `api/listings`, `api/search`, similar-products).

**WEB-2 — Core marketplace SEO missing**
`products/[id]/page.tsx` has no `generateMetadata` — product pages render with the generic root title despite sitemap priority 0.8 and the data already being fetched server-side. `components/seo/SeoJsonLd.tsx` (Product/Organization JSON-LD) exists but is **never imported anywhere**.

**WEB-3 — Counterparty email/PII over-fetched** — `api/orders/route.ts:58-74`, `orders/page.tsx:38-54`
Both select `email` for buyer _and_ seller plus full address records and return the whole object — each party receives the other's email. **Fix:** trim selects to what the UI renders.

**WEB-4 — No route-level error handling**
Only a Sentry `global-error.tsx` exists. Any server throw in the DB-dependent, force-dynamic pages (`/orders`, `/messages`, `/listings`, `/products/[id]`) nukes the whole document; `notFound()` renders Next's unstyled default. **Fix:** root `error.tsx` + `not-found.tsx`, plus segment-level ones for products/listings/orders.

#### 🟡 Medium

- **WEB-5 — Unbounded `findMany`**: `api/orders/route.ts:46`, `orders/page.tsx:25`, `messages/layout.tsx:30` (all conversations + includes on every messages navigation) — no `take`/cursor.
- **WEB-6 — Seller dashboard fetches client-side**: all `/seller/*` pages are `"use client"`; `seller/page.tsx:44` calls `/api/seller/listings?limit=1` just to read a stats side-payload (server runs the full listings query, result discarded). Convert to server components like `/orders` already does; only Stripe-embedded pages need client rendering.
- **WEB-7 — ~200 lines of listing-query logic triplicated** across `listings/page.tsx`, `category/[slug]/page.tsx`, and `api/listings/route.ts`. Extract a shared `getListings()` in `lib/`.
- **WEB-8 — Everything is force-dynamic, no ISR**: root layout sets `force-dynamic`; even terms/help/coming-soon get zero static benefit. Remove the root override; add `revalidate` to catalog pages.
- **WEB-9 — Design-system violations in client components**: 62 raw hex occurrences (worst: `SellFormClient.tsx` ×12, `WaitlistForm.tsx` ×7 — `#F45314` inline instead of `$primary`); raw HTML elements incl. raw `<input>`/`<button>` in `WaitlistForm.tsx`, `mobile-onboarding/page.tsx` (×15), `EditProductModal.tsx`.
- **WEB-10 — Monolithic client components in main bundle**: `SellFormClient.tsx` (1,267 lines), `OrderDetail.tsx` (1,080) with no dynamic splitting; only Clerk components are lazy-loaded app-wide.

#### 🟢 Low

- **WEB-11 — Dead code (verified zero imports)**: `HomeClient.tsx`, `SellerOnboarding.tsx`, `AuthModal.tsx`, `AuthHeader.tsx`, `SellingPlaceholder.tsx`, `CategoryGrid.tsx`, `ProductCardWithCart.tsx`, `AnimatedAddToCartButton.tsx`; plus `sentry-example-page` and the debug endpoints (SEC-4).
- **WEB-12 — Console noise**: `lib/email.ts` (32 console calls), `api/stripe/webhook/route.ts` (26) — should use a leveled logger given Sentry is integrated.
- **WEB-13 — Misc**: `getSimilarProducts` re-fetches the product just loaded; `getProduct` returns `null` on any DB error (transient failures become 404s); `cloudinary.uploader.destroy().catch(() => {})` silently leaks orphaned images; raw `<img>` on the homepage hero (×4); duplicate route trees (`/settings/addresses` vs `/account/addresses`); web forks `ProductCard` instead of consuming `packages/app`'s; Suspense fallbacks wrap already-awaited data (never show).

#### Done well (web)

- **Zero Tamagui imports in server components** (the project's #1 rule — fully respected, clean client-wrapper pattern), zero direct `@prisma/client` imports, design-system greps clean (no `align=`/`justify=`, no bare `gap`, no `fontSize` on Text).
- Listings/category pages are textbook server-fetch + client-interactivity: parallel `Promise.all`, real pagination, tight selects, debounced refetch, `startTransition`.
- No self-API fetching from server code; good `auth()` + redirect hygiene; proper sitemap setup.

### 3.4 Payments & money flow (highest-risk area)

Money flow: buyer pays the platform (no `transfer_data`), the webhook creates the order as `HELD`, and funds reach the seller via `confirm-receipt`, the daily `release-payments` cron (14 days after delivery), or the Connect webhook draining `PENDING_SELLER_ONBOARDING` orders.

#### 🔴 Critical

**PAY-1 — Refunds and disputes never stop the escrow; cron can pay the seller after the buyer was refunded (double loss)**
`api/stripe/webhook/route.ts:775-825` (`handleRefund` sets `status: "REFUNDED"` but **never touches `paymentHoldStatus`**); dispute handlers (`:831-861`) are log-only TODOs. No code anywhere writes `REFUNDED`/`DISPUTED` to `paymentHoldStatus` — both enum states are unreachable. The cron (`api/cron/release-payments/route.ts:53-65,176-194`) selects on `paymentHoldStatus: "HELD"` and performs **no refund/dispute check** before `transfers.create` (unlike `confirm-receipt`, which checks `charge.refunded`). A refunded or actively-disputed order still auto-releases: the platform refunds the buyer AND pays the seller.
**Fix:** set `paymentHoldStatus` in `handleRefund`/`handleDisputeCreated`; have the cron retrieve the charge and skip if `refunded || amount_refunded > 0 || disputed`.

**PAY-2 — Connect-webhook payout drain can create duplicate transfers**
`api/stripe/connect/webhook/route.ts:332-470`: the "lock" sets `stripePayoutStatus: "processing"` but the selection filter is only `paymentHoldStatus: "PENDING_SELLER_ONBOARDING"` — which the claim never changes — so concurrent invocations select the same orders. Not theoretical: completing onboarding fires `account.updated` + `capability.updated` (×2) + `person.updated` within seconds, and _every one_ calls this drain. Crucially this `stripe.transfers.create` (L424-436) has **no idempotency key** (the other two transfer sites have one) — concurrent runs create two real full payouts.
**Fix:** atomic per-order `updateMany` claim + `idempotencyKey: onboarding-release:${order.id}`.

**PAY-3 — Mobile purchases charge the buyer but never create an order**
`apps/mobile/components/MobileCheckoutSheet.tsx:202-239` collects only **billing** details — `PaymentIntent.shipping` is never set. `lib/create-order-from-payment-intent.ts:80-85` returns `null` without shipping; the webhook (`route.ts:742-749`) logs and **returns 200**, so Stripe never retries; the `by-payment-intent` fallback returns `"processing"` forever. Net: buyer charged, no order, no label, no seller notification — silent revenue capture requiring manual support for every mobile sale.
**Fix:** collect shipping in the PaymentSheet (or attach at PI creation), and return 5xx from the webhook when order creation fails for a `payment_element` PI so Stripe retries (see PAY-6).

**PAY-4 — Double-sell: availability checked only at intent creation, never at payment time**
Both checkout routes pre-check `isSold`, but neither webhook handler re-checks it, and `isSold` is set in a separate non-transactional update after `order.create` (`webhook/route.ts:339-342`). Two buyers can both complete payment (different PI IDs, so `stripePaymentId @unique` doesn't help); an Embedded Checkout session stays payable up to 24h after the product sold elsewhere. Both payouts can then release for one physical item.
**Fix:** atomically claim the product in the webhook (`updateMany({ where: { id, isSold: false }, data: { isSold: true } })`); auto-refund the losing PI.

#### 🟠 High

- **PAY-5 — confirm-receipt vs cron race → two transfers for one order**: `confirm-receipt/route.ts` is check-then-act (read at L40, slow `charges.retrieve` at L112, transfer at L183, unconditional update at L211) with **a different idempotency key** (`confirm-receipt:` vs the cron's `auto-release:`), so Stripe deduplicates nothing if the cron claims the order mid-flight. **Fix:** atomic `updateMany` claim like the cron, or one shared key `release:${orderId}` across all three transfer sites.
- **PAY-6 — Sellers can self-trigger the 14-day auto-release without shipping**: `api/orders/[id]/shipment-status/route.ts:71-108` lets the _seller_ set `DELIVERED` with no carrier verification — the only code path that sets `autoReleaseAt`. A fraudulent seller never ships, marks DELIVERED, and gets paid in 14 days (and per PAY-1, even an open dispute doesn't stop it). **Fix:** gate DELIVERED on carrier-webhook-verified tracking.
- **PAY-7 — The inverse: carrier-verified deliveries never start the release clock**: both `shipengine/webhook` and `easypost/webhook` set `shipmentStatus: DELIVERED` + `deliveredAt` but never `autoReleaseAt`, which the cron requires — tracked orders sit `HELD` indefinitely unless the buyer manually confirms. Honest sellers never get auto-paid. **Fix:** set `autoReleaseAt` in both carrier webhooks.
- **PAY-8 — `payment_intent.succeeded` failures acked with 200**: any null from `createOrderFromPaymentIntent` is logged and acked — Stripe never retries, paid orders silently dropped (amplifier for PAY-3). `handleCheckoutCompleted` correctly returns 4xx by contrast.
- **PAY-9 — `PENDING_SELLER_ONBOARDING` orders have exactly one escape hatch**: only a future `account.updated` event drains them; the cron ignores the status entirely. A dropped webhook = seller money stuck forever with no reconciliation. **Fix:** handle the status in the daily cron.

#### 🟡 Medium

- **PAY-10 — Cron crash window**: order claimed `RELEASED` before `transfers.create`; a crash between leaves `RELEASED` + `stripeTransferId: null` — matched by no query, seller never paid, nothing alerts. Add a reconciliation query + alert.
- **PAY-11 — Full refund unconditionally relists the product** (`webhook/route.ts:814-821`) — even goodwill refunds after delivery make the physically-gone item purchasable again (compounds PAY-4).
- **PAY-12 — Carrier webhook signature verification is optional**: if `SHIPENGINE_WEBHOOK_SECRET` is unset, unsigned payloads are accepted and can set arbitrary shipment states by `trackingCode`; unknown status codes map to `IN_TRANSIT`, so late events can downgrade DELIVERED and freeze releases. Hard-fail like the Stripe webhook does; never regress from DELIVERED.
- **PAY-13 — Promotion races**: duplicate-check (ACTIVE only) + PENDING creation are non-atomic; two rapid purchases double-charge the seller for one promotion. No amount validation on activation; stale PENDING rows never cleaned.

#### 🟢 Low

- Buyer-protection fee formula independently implemented in 3 places (server `lib/pricing.ts`, mobile sheet, web display) and shipping prices hardcoded in 4 files — display-only drift risk today since the charge is always server-computed, but extract to `@buttergolf/constants`.
- Checkout webhook idempotency is read-then-write; saved by `stripePaymentId @unique`, but each retry leaks an orphan `Address` row. Wrap in a transaction.
- Partial-refund asymmetry: confirm-receipt blocks on any `amount_refunded > 0`, the cron blocks on nothing.

#### Done well (payments)

- Signature verification on both Stripe webhooks; `CRON_SECRET` enforced (fails closed).
- `source_transaction` + `transfer_group` on transfers; idempotency keys on 2 of 3 transfer sites; the cron's `updateMany` HELD→RELEASED claim is genuinely atomic with rollback.
- Fee math in integer pence end-to-end server-side, amounts pinned in PI metadata at creation.
- Offer flow validated properly: ownership, ACCEPTED status, product match, counter bounds (50-100% of list) — no price-manipulation hole found.

### 3.5 Mobile app & shared packages

#### 🟠 High

- **MOB-1 — HomeScreen infinite refetch loop**: `packages/app/src/features/home/home-screen.tsx:57-74` re-fires its fetch effect whenever `products.length === 0 && !loading`; `fetchProducts` (`App.tsx:233-266`) swallows errors and returns `[]` — offline (or with a genuinely empty marketplace) the app polls the API forever. The fetched products are also never rendered (the home screen shows only hero + categories), and the search bar's `onSearch` is a `console.info` stub.
- **MOB-2 — Push token never deregistered on sign-out**: `clearStoredPushToken` and `unregisterPushTokenFromBackend` (`lib/notifications.ts:161-176, 267-297`) are dead code — never called. On a shared device, user A keeps receiving user B's order/message pushes after sign-out.
- **MOB-3 — SSE auth token cached once, expires in ~60s**: `App.tsx:1711-1726` bakes one `getToken()` result into the EventSource factory; every reconnect after the first minute sends an expired JWT, so realtime messaging silently dies and degrades to 10s polling. (`deferredFetch` does it correctly — per-request.)
- **MOB-4 — Invisible Sell-flow header buttons**: `sell-screen.tsx:189-193` renders white icons on a white header — users can't see how to exit or go back in step 1.
- **MOB-5 — Push notification taps do nothing**: `App.tsx:2050-2069` logs the payload but never navigates ("handled by deep linking" — no such code exists).

#### 🟡 Medium

- **MOB-6 — Mobile linking config contradicts shared routes**: `routes.ts` says `/orders/[id]`; mobile maps `account/orders/:orderId` (`App.tsx:193-198`) — universal links `https://buttergolf.com/orders/123` won't resolve on mobile. Auth/seller/account sub-routes are hardcoded in App.tsx, defeating the single-source-of-truth file.
- **MOB-7 — App.tsx (2,609 lines)**: file-wide `no-explicit-any` disable erases the shared screens' good prop types at exactly the integration boundary; ~340 lines of duplicated wrapper logic (`handleStartSellerOnboarding` byte-identical ×2, buy/offer/checkout trio ×2, label actions ×2); `EXPO_PUBLIC_API_URL` read 22 times; the 700ms double-refresh hack in Favourites; `OnboardingFlow` recreates its Stack navigator every render, breaking signed-out deep links. _(Decomposition proposal: extract `src/api/` client, per-screen wrappers, linking config derived from `routes.ts`, navigators, providers, and a push-token lifecycle component — App.tsx drops to ~300 lines.)_
- **MOB-8 — Wrapper/screen contract drift**: `OrdersScreenWrapper` builds server-side `?filter=` that the screen never invokes (dead path, filters client-side); nothing navigates to `SellerDashboard` (reachable only by deep link).
- **MOB-9 — No error state in CategoryListScreen / Sell pickers**: fetch errors are swallowed to `[]` — offline users see "no products" with no retry. (Orders, Messages, Favourites, ProductDetail do this properly.)

#### 🟢 Low

- UI-kit variant inconsistency (`Button size="$5"` vs `Spinner`/`Badge` named `sm|md|lg` — root CLAUDE.md documents the wrong API); dead components (`BrandBackgrounds`, `HeroSection`, `ProductGrid`, `SearchBar`, `MinimalRoot.tsx`); design-token violations in `onboarding/screen.tsx`, `Hero.tsx`, `messages-screen.tsx`; `formatCurrency` re-declared in 5+ screens; ProductDetail's heart button has no `onPress`; `tokenCache` recreated per render; Clerk user IDs logged.

#### Done well (mobile/shared)

- The shared-screen architecture is genuinely clean: platform-agnostic screens with typed `onFetchX` props; `MessageThreadScreen` is the standout (optimistic sends, retry-without-retyping, SSE backoff + polling net).
- Crash-hardening is thoughtful and documented: `deferredFetch` defers TurboModule access behind `InteractionManager` with breadcrumbs; `SafeStripeProvider` degrades gracefully in Expo Go; `SellerStatusContext` has abort controllers + cooldowns with a clear "why" trail.
- Accessibility labels broadly present; zero legacy `align=`/`justify=` props; navigation theming derives from `brandColors` rather than duplicated hex.

## 4. Prioritised action list

**Fix now (financial/security exposure):**

1. **PAY-1** — Set `paymentHoldStatus` on refund/dispute; add refund/dispute check to the release cron.
2. **PAY-2** — Idempotency key + atomic claim in the Connect-webhook payout drain.
3. **PAY-3 / PAY-8** — Collect shipping in the mobile PaymentSheet; return 5xx from the webhook when order creation fails so Stripe retries.
4. **PAY-4** — Atomic `isSold` claim at order creation; auto-refund the loser.
5. **SEC-1** — Remove the mobile-session secret fallbacks; require `MOBILE_SESSION_SECRET`.
6. **SEC-2 / SEC-3 / SEC-4** — Auth on `getMyProducts` and `by-session`; delete debug endpoints.
7. **WEB-1 / DB-3** — `isDraft: false` on every public read path (incl. sitemap).

**Fix this sprint (correctness/payout reliability):**

8. **PAY-5/6/7/9** — Unify transfer idempotency keys; carrier-verified delivery gating; set `autoReleaseAt` in carrier webhooks; drain `PENDING_SELLER_ONBOARDING` from the cron.
9. **DB-1** — Migrate money fields `Float` → `Int` pence.
10. **DB-2 / DB-5** — Enforce `isDeleted` filtering (client extension); add the missing unique constraints (`ProductPromotion.stripePaymentId`, `(userId, requestId)`).
11. **MOB-1…5** — Refetch loop, push-token sign-out lifecycle, SSE token refresh, invisible sell-header buttons, notification-tap navigation.
12. Repair the quality gate: fix the `svg.d.ts` tsconfig include, add `packages/db/generated` to `.prettierignore`, re-enable pre-push, and add a minimal CI workflow (`pnpm check` + `pnpm build`).

**Schedule (debt/scale):**

13. Tests for the payment lifecycle first (webhook → order → release), then API authz; even a thin integration suite would have caught most criticals.
14. WEB-2 (product-page metadata + wire up the existing JSON-LD), WEB-3 (PII over-fetch), WEB-4 (error boundaries), WEB-8 (ISR).
15. App.tsx decomposition (MOB-7 proposal); extract shared fee/shipping constants (PAY-L1).
16. Docs truth pass: CLAUDE.md product description + dead links, `packages/db` CLAUDE.md models, README; repo cleanup (Lighthouse artifacts, `.expo/`, vendored docs, one-off scripts); `.env.example` completeness (14+ missing vars).

---

## 5. Review fixes applied on this branch

Fixes were applied across the codebase on this branch (see commit history). `pnpm check` (format + lint + type-check) passes on every package.

**Security**

- **SEC-1** — `mobile-session.ts` requires `MOBILE_SESSION_SECRET` (no Stripe-key or hardcoded fallback).
- **SEC-2** — `getMyProducts` derives the user from `auth()`; no caller-supplied `clerkId`.
- **SEC-3** — `by-session` order lookup requires auth + buyer/seller ownership.
- **SEC-4** — `debug-clerk` and Sentry example route/page removed.
- **SEC-6** — CORS allowlist in `proxy.ts` (no origin reflection / `*`); auth-header debug logging removed.
- **SEC-7** — rate limiting added to shipping-calculate, waitlist, upload, create-payment-intent, promotions (shared `enforceIpRateLimit`/`checkRateLimit` helpers).
- **SEC-8** — error responses genericised (no internal `error.message` leakage) across seller-status, mobile-onboard, mobile-session, account-session, shipping.
- **SEC-9** — admin IDs moved from `proxy.ts` to `ADMIN_USER_IDS` env var.

**Payments**

- **PAY-1** — refund/dispute set `paymentHoldStatus` (REFUNDED/DISPUTED); release cron verifies the charge isn't refunded/disputed before transferring; dispute handlers freeze/unfreeze escrow.
- **PAY-2** — Connect onboarding drain: per-order atomic claim + Stripe idempotency key.
- **PAY-4** — double-sell guard: conflicting-order detection + auto-refund; product marked sold atomically with order creation (transaction) in both checkout and PaymentElement paths.
- **PAY-5** — unified `release:${orderId}` idempotency key across all three transfer sites; atomic claim in confirm-receipt.
- **PAY-7** — carrier webhook sets `autoReleaseAt` on delivery; never regresses a DELIVERED order.
- **PAY-8** — `payment_intent.succeeded` returns non-2xx on order-creation failure so Stripe retries (discriminated `CreateOrderResult`); refunded-duplicate acks.
- **PAY-9 / PAY-10** — release cron drains `PENDING_SELLER_ONBOARDING` orders and logs orphaned `RELEASED`-without-transfer rows.
- **PAY-11** — refunds only relist unshipped items.
- **PAY-12** — ShipEngine webhook requires its signature secret (fails closed); EasyPost dead integration removed.
- **PAY-13** — promotion duplicate/PENDING guard + amount validation on activation.

**Data model & infra**

- **DB-2** — deleted sellers' products excluded from every public read; user-deletion webhook hardened (deletes only order-less products).
- **DB-3 / WEB-1** — `isDraft: false` on all public read paths (incl. sitemap); drafts visible to owner only.
- **DB-5 / DB-6** — unique constraints (ProductPromotion.stripePaymentId, Order stripeCheckout/charge/transfer, Product `(userId, requestId)`) + composite indexes; migration SQL in `packages/db/prisma/migrations/20260610120000_review_hardening_constraints_indexes`.
- **DB-8** — repair script moved out of the migrations directory into `scripts/`.
- **INF-1** — HSTS + Permissions-Policy headers added.
- **INF-2** — CI workflow (`.github/workflows/ci.yml`: format + lint + type-check); pre-push type-check re-enabled.
- **INF-3 / INF-6** — `.env.example` + `turbo.json` env vars reconciled; dead `db:generate` inputs removed.
- **Baseline** — `pnpm check` fixed (svg typings include; generated Prisma client prettier-ignored).

**Web**

- **WEB-2** — product `generateMetadata` + Product JSON-LD (wired the unused `SeoJsonLd`).
- **WEB-3** — counterparty email no longer returned from orders API/page.
- **WEB-4** — root `error.tsx` + `not-found.tsx`.
- **WEB-5** — pagination caps on orders queries.
- **WEB-11 / WEB-13** — 8 dead components removed; orphaned-asset cleanup now logged.

**Mobile & shared**

- **MOB-1** infinite refetch loop, **MOB-2** push-token sign-out deregistration, **MOB-3** SSE token refresh, **MOB-4** invisible Sell header buttons, **MOB-5** notification-tap navigation, **MOB-6** linking/route alignment, **MOB-9** error/retry states; duplicated wrapper logic and `formatCurrency` extracted to shared helpers; dead components removed.

**Documentation**

- **DOC-1** — CLAUDE.md product description + dead links fixed; `packages/db` CLAUDE.md `db`→`prisma`; README rewritten; repo clutter removed/git-ignored (INF-4).

### Deliberately deferred (with rationale)

These require a live database, a running app/device, or a coordinated maintenance window to do safely — applying them blind would risk regressions worse than the finding:

- **DB-1 (money `Float` → `Int` pence)** — needs a data backfill (×100) and synchronized changes at every read/write/display site across web, mobile, and shared packages. The current code is not exploitable (`Math.round` absorbs FP noise); a half-applied migration could corrupt live values. Ship as its own migration PR against staging.
- **DB-4 (cascade → Restrict on promotions/offers)** — would change product/user deletion behaviour; the existing "block delete if product has orders" guard already protects sale-linked records transitively. Needs deletion-flow testing.
- **DB-7 (stringly-typed state → enums)** — requires data backfill of existing string values.
- **PAY-3 (mobile PaymentSheet shipping collection)** — ships in the app binary and changes checkout UX; PAY-8 now makes the failure loud (Stripe retries) rather than silent in the meantime.
- **PAY-6 (carrier-verified delivery gating for auto-release)** — a fraud/policy decision (how to treat seller-set DELIVERED).
- **WEB-6/7/8/9/10 (server-component dashboard, shared `getListings`, ISR, design-token sweep, component splitting)** — refactors/perf on the highest-traffic pages that need the app running to verify; the report rated them Medium/Low.
- **CSP header** — a wrong policy breaks Stripe/Clerk/Cloudinary; needs iterative testing against the live app.
- **Automated tests** — the most valuable follow-up; CI is now in place to run them once written.
