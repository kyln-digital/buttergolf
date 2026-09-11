# Web App & API

The web app (`apps/web/`) is a Next.js 16 App Router application deployed on Vercel. It is the backend for **both** platforms — the mobile app consumes the same API routes. Build scripts pin **Webpack** (`next dev --webpack` / `next build --webpack`); Turbopack is not used, and the alias/extraction config assumes Webpack.

## Pages (App Router)

All routes live under `apps/web/src/app/`. Key ones:

| Route                                                | Notes                                                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                  | Marketplace home                                                                                                              |
| `/listings`, `/category/[slug]`                      | SSR listing pages sharing query logic via `lib/listings.ts`                                                                   |
| `/products/[id]`                                     | Product detail (`generateMetadata` + Product JSON-LD)                                                                         |
| `/checkout`, `/checkout/success`, `/checkout/cancel` | Success page polls order by session/payment-intent                                                                            |
| `/cart`, `/favourites`, `/orders`, `/orders/[id]`    | Buyer surfaces                                                                                                                |
| `/sell`, `/seller/*`                                 | Seller surfaces (protected routes — see proxy below)                                                                          |
| `/messages`, `/messages/[conversationId]`            | Messaging with Supabase Realtime                                                                                              |
| `/mobile-onboarding`                                 | **WebView-only page** for Stripe Connect embedded onboarding (RN `postMessage` bridge; auth via `?token=` mobile-session JWT) |
| `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | Clerk catch-all routes                                                                                                        |
| `/coming-soon`                                       | Pre-launch landing (`noindex`), active only when `NEXT_PUBLIC_COMING_SOON_ENABLED=true`                                       |

Error pages: `error.tsx` / `global-error.tsx` are Sentry-instrumented client components; `not-found.tsx` is a **plain server component with inline styles** — deliberately no Tamagui (see [Architecture](architecture.md) "never import Tamagui in server components").

## Middleware: `src/proxy.ts` (not `middleware.ts`)

Next.js 16 renamed middleware to **`proxy.ts`** — this trips people up constantly. It wraps `clerkMiddleware` and handles:

1. **CORS** — reflects `Access-Control-Allow-Origin` only for origins in the `ALLOWED_ORIGINS` env allowlist (never `*`)
2. **Coming-soon mode** — redirects all traffic to `/coming-soon` unless allowlisted or the Clerk userId is in `ADMIN_USER_IDS` (TODO-marked for post-launch deletion)
3. **Route protection** — `auth.protect()` only for `/sell(.*)`, `/seller(.*)`, `/admin(.*)`, `/dashboard(.*)`, `/profile(.*)`. `/api/upload` is deliberately excluded because it self-manages auth (mobile Bearer support). `/admin` only checks for a session here; the staff role is checked in `app/admin/layout.tsx` and per API route.

⚠️ The `src/middleware/` **directory** is not middleware at all — it contains `rate-limit.ts`, a helper library imported by route handlers.

## Auth Model (Three Credential Types)

Most API routes resolve the caller via `getUserIdFromRequest(request)` (`apps/web/src/lib/auth.ts`), which accepts, in order:

1. Clerk session cookies (web)
2. Clerk Bearer tokens (native app)
3. The 15-minute mobile-session JWT (`Authorization: Bearer <jwt>`, signed with `MOBILE_SESSION_SECRET` — HS256 via `jose`, must be ≥32 chars)

The mobile-session JWT exists so long-lived Clerk tokens never appear in WebView URLs: the app exchanges a Clerk Bearer token at `POST /api/stripe/connect/mobile-session`, then passes the short-lived JWT to `/mobile-onboarding` via `?token=`.

Routes authenticated with Bearer headers and GET semantics (`/api/favourites`, `/api/products/[id]/similar`, `/api/orders/[id]/tracking`) set `force-dynamic` so Vercel's edge caching doesn't strip the `Authorization` header.

### Staff (admin portal)

Staff access is a database role, `users.role` (`USER` | `SUPPORT` | `ADMIN`), plus a bootstrap: any Clerk ID in `ADMIN_USER_IDS` is `ADMIN` whatever the column says. `apps/web/src/lib/admin-auth.ts` exposes `getAdminForPage()` (server components) and `requireAdmin(request, permission?)` (API routes); the permission table is the pure `can(role, permission)` in `lib/admin-permissions.ts` (unit-tested). SUPPORT can read everything, triage buyer issues and hide listings; everything that moves money, suspends people or changes roles is ADMIN. Every mutating admin route writes an `AdminAction` row via `lib/admin-audit.ts`, inside the same transaction where there is one.

The staff row is found by Clerk ID first. Production and previews use different Clerk instances against the one database, so the same person has a different Clerk ID on a preview; when the ID misses, `resolveAdmin` falls back to the signed-in account's verified email. Note a person can also end up with **two** rows (one per Clerk instance, the preview one with a `temp-<clerkId>@buttergolf.app` email created by the sign-up fallback) — grant the role on both if they need the portal on previews.

Suspended users (`users.suspendedAt`) can sign in and view orders but every route that lists, publishes, buys, messages or offers returns 403 `ACCOUNT_SUSPENDED` (`lib/suspension.ts`), and their listings drop out of every public query via `PUBLIC_PRODUCT_WHERE` / `PUBLIC_SELLER_FILTER` in `lib/listings.ts` — the same fragment that hides staff takedowns (`products.hiddenAt`).

## API Route Map

57 route handlers under `apps/web/src/app/api/`. Grouped by domain:

### Catalog & search

| Route                                                              | Purpose                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `POST /api/products`                                               | Create listing (maps condition slider → `ProductCondition`; enforces price limits)                         |
| `GET /api/products/[id]` / `/similar` / `/recent`                  | Detail / similar / recent products (`recent` is a thin wrapper over the `getRecentProducts` server action) |
| `GET /api/listings`                                                | Paginated feed — shares filter/sort/card logic with the SSR pages via `lib/listings.ts`                    |
| `GET /api/search`, `/api/brands`, `/api/models`, `/api/categories` | Search, brand autocomplete, model suggestions, categories                                                  |

### Checkout & payments

| Route                                        | Purpose                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/checkout/create-checkout-session` | Stripe Embedded Checkout Session (web; optionally from an accepted `offerId`)                                                                    |
| `POST /api/checkout/create-payment-intent`   | PaymentIntent for the PaymentElement/mobile flow — IP rate-limited                                                                               |
| `POST /api/stripe/webhook`                   | Payment webhook: `checkout.session.completed`, `payment_intent.succeeded` (order creation via `createOrderFromPaymentIntent`), refunds, disputes |
| `POST /api/stripe/connect/webhook`           | Connect webhook: `account.updated` → `processPendingTransfersForSeller()`                                                                        |
| `POST /api/promotions/purchase`              | Buy Bump (£0.99/24h) or Pro Shop Feature (£4.99/7d)                                                                                              |

See [Payments & Escrow](payments.md) for the money flow.

### Orders

| Route                                                 | Purpose                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/orders`                                     | List buyer/seller orders                                                                                                                             |
| `GET /api/orders/[id]`                                | Order detail                                                                                                                                         |
| `POST /api/orders/[id]/confirm-receipt`               | Buyer confirms → releases held payment                                                                                                               |
| `POST/GET /api/orders/[id]/label`                     | Generate/fetch ShipEngine label (seller only)                                                                                                        |
| `GET/POST /api/orders/[id]/rating`                    | Seller rating (rate-limited)                                                                                                                         |
| `PATCH /api/orders/[id]/shipment-status`              | Update shipment status; DELIVERED sets `autoReleaseAt = +14 days`                                                                                    |
| `GET /api/orders/[id]/tracking`                       | Live ShipEngine tracking (5-min cache)                                                                                                               |
| `GET /api/orders/by-session/[sessionId]`              | Lookup by Stripe Checkout Session (success page)                                                                                                     |
| `GET /api/orders/by-payment-intent/[paymentIntentId]` | Lookup by PaymentIntent — **fallback that creates the order client-side if the webhook was delayed/missed**, guarded by fail-closed ownership checks |

### Conversations & offers

| Route                                                                     | Purpose                                       |
| ------------------------------------------------------------------------- | --------------------------------------------- |
| `GET/POST /api/conversations`                                             | Inbox / start conversation                    |
| `GET/POST /api/conversations/[id]/messages`                               | Cursor-paginated messages (POST rate-limited) |
| `POST /api/conversations/[id]/messages/mark-read`                         | Mark read                                     |
| `POST /api/conversations/[id]/offer` (+ `/accept`, `/counter`, `/reject`) | Offer lifecycle (see [Domain](domain.md))     |
| `GET /api/conversations/unread-count`                                     | Unread badge                                  |

### Seller, users, misc

`/api/seller/listings` (seller stats), `/api/seller/products/[id]` (PATCH/DELETE own product), `/api/users/seller-status`, `/api/users/push-tokens` (Expo registration), `/api/user/phone`, `/api/addresses` (+ `[id]`, `/default`), `/api/favourites` (+ `[productId]`), `/api/upload` (Cloudinary, self-managed auth + CORS; also accepts the phone QR session token as a Bearer credential and records those uploads in `phone_uploads`), `/api/upload/phone-session` (POST, Clerk: mints the QR token for the sell form; GET, Bearer: session status for the phone page), `/api/upload/phone-session/[sessionId]` (GET, Clerk: photos the phone has sent, polled by the sell form; DELETE, Clerk: close the session so the phone is refused), `/api/images/[id]` (DELETE), `/api/clerk/webhook` (svix user sync), `/api/newsletter`, `/api/waitlist`, `/api/shipping/calculate` (rate-limited), `/api/shipengine/webhook` (HMAC-verified, monotonic status).

### Buyer issues

`POST /api/orders/[id]/issue` (buyer only) — report a problem with an order. Allowed while the payout is still with us (`HELD` or `PENDING_SELLER_ONBOARDING`; rule in `lib/order-issue-state.ts`). Creates the `OrderIssue`, moves `paymentHoldStatus` to `DISPUTED` (every release path already refuses that state), posts a `SYSTEM` message into the order conversation, emails the seller and `ADMIN_NOTIFICATION_EMAIL`.

### Admin (`/api/admin/*`, all behind `requireAdmin`)

- `PATCH /api/admin/users/[id]` — `{ role }` or `{ suspend, reason }`. Nobody can act on themselves; staff can't be suspended.
- `POST /api/admin/orders/[id]/refund` — full or partial Stripe refund; `reverseTransfer` claws back a paid-out seller first; `cancel` marks the order CANCELLED. Same bookkeeping as the `charge.refunded` webhook (`applyFullRefundToOrder` is shared).
- `POST /api/admin/orders/[id]/release` — pay the seller now; same claim and `release:<orderId>` idempotency key as confirm-receipt and the cron.
- `POST /api/admin/orders/[id]/hold` — `{ freeze }`; unfreeze refuses while a buyer issue or Stripe chargeback is open.
- `PATCH /api/admin/orders/[id]` — `{ shipmentStatus }` override with the ShipEngine webhook's side effects (shippedAt, deliveredAt, auto-release clock).
- `PATCH /api/admin/issues/[id]` (triage), `POST /api/admin/issues/[id]/resolve` — `{ resolution: REFUNDED | RELEASED | DISMISSED, note }`; money moves first, the issue closes only if that succeeds, both parties are emailed.
- `PATCH /api/admin/listings/[id]` — `{ hidden, reason }` (SUPPORT+) or `{ title, price, categoryId, brandId }` (ADMIN).
- `GET|POST /api/admin/reference/{brands|categories|club-models}`, `PATCH|DELETE .../[id]` — lookup-table CRUD; delete refuses anything in use.
- `GET /api/admin/export/{waitlist|newsletter}` — CSV download, logged.

All of these live in `apps/web/src/lib/admin-*.ts`; the routes are thin.

Cron endpoints (`/api/cron/*`) are listed in [Operations](operations.md).

## Server Actions

Exactly one file: `apps/web/src/app/actions/products.ts` — `getRecentProducts(limit)` and `getMyProducts(limit)`. The app is otherwise **route-handler-first for mutations**.

## Key `lib/` Utilities

| File                                                            | Purpose                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `listings.ts`                                                   | Shared listing-query builder — the single source of truth for filters/sort/card shape used by `/listings`, `/category/[slug]`, and `/api/listings` so the three surfaces can't drift |
| `pricing.ts`                                                    | Buyer-protection fee math (re-exported from `@buttergolf/constants`), `AUTO_RELEASE_DAYS`, promotion prices/durations                                                                |
| `checkout-session-ownership.ts` / `payment-intent-ownership.ts` | Fail-closed BOLA guards proving requester ownership of Stripe objects                                                                                                                |
| `create-order-from-payment-intent.ts`                           | Shared order creation from a succeeded PaymentIntent; returns `"ok" \| "refunded_duplicate" \| "pending"` (double-sell guard auto-refunds the loser)                                 |
| `mobile-session.ts`                                             | Mobile WebView JWT create/verify (see auth model above)                                                                                                                              |
| `shipengine.ts`                                                 | ShipEngine client: rates, labels, tracking                                                                                                                                           |
| `supabase-realtime.ts`                                          | Realtime channel → `EventSourceLike` adapter for message threads                                                                                                                     |
| `email.ts`                                                      | Resend transactional email (20+ templates)                                                                                                                                           |
| `address-validation.ts`                                         | UK postcode/phone/address validation                                                                                                                                                 |
| `auth.ts` / `auth-helpers.ts`                                   | The triple-credential resolver + Clerk→Prisma user upsert                                                                                                                            |
| `middleware/rate-limit.ts`                                      | In-memory per-instance rate limiting (resets on cold start — accepted trade-off)                                                                                                     |

## `next.config.js` Highlights

- **Tamagui plugin** with CSS extraction to `public/tamagui.css` (prod; file is build-generated, not committed)
- **Webpack aliases**: `react-native$ → react-native-web`; singleton dedupe for `tamagui`, `@tamagui/core`, `@buttergolf/config`
- **Prisma monorepo workarounds**: `PrismaPlugin`, `outputFileTracingRoot` at monorepo root, `serverExternalPackages`
- **Clerk proxy rewrite** (`/__clerk/:path*`) when `NEXT_PUBLIC_CLERK_PROXY_URL` is set (prod only)
- **Security headers** (also set in `vercel.json`); CSP deliberately omitted
- TypeScript build errors are **not** ignored — `tsc` passes clean and the build type-checks

## Watch Out For

- Never add a `src/middleware.ts` — the convention here is `src/proxy.ts`
- Adding a Bearer-authenticated GET route? Set `force-dynamic` or the Authorization header gets eaten by edge caching
- Changing listing filters? Do it in `lib/listings.ts`, not in the page or API route, or the SSR pages and API feed drift
- Two Stripe webhooks with **different secrets**: `STRIPE_WEBHOOK_SECRET` (payments) vs `STRIPE_CONNECT_WEBHOOK_SECRET` (Connect)
- Payout setup is ButterGolf's own form (`/api/stripe/connect/setup/details`, `/setup/bank-account`); `/api/stripe/connect/account` only issues the embedded component session used as a verification fallback
