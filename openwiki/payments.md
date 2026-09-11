# Payments & Escrow

ButterGolf uses **Stripe Connect** with the **Separate Charges and Transfers** pattern — a platform-escrow model where the seller need not be onboarded at checkout time. This is one of three official Stripe Connect charge types, explicitly designed for marketplaces where the recipient isn't known at payment time.

**Core principle**: Stripe onboarding is never required to list or sell a product. It is only required to _receive funds_. This keeps the listing and purchasing experience frictionless.

> This page summarizes the full model documented in `docs/STRIPE_CONNECT_MODEL.md` and `docs/STRIPE_EMBEDDED_ONBOARDING_GUIDE.md`. Refer to those docs for implementation-level detail.

## How It Works

```
SELLER:  Sign Up → List Product ───────→ Product Sells → Ship Item → Add Payout Details → Receive Funds
         (Clerk)    (Connect account       (No Stripe)     (No Stripe)  (Our own form,        (Transfer)
                     created silently)                                   never a Stripe form)

BUYER:   Browse → Purchase → Receive Item → Confirm Receipt
                    (Stripe       (Shipping)    (Triggers fund release)
                     Checkout)

Payment goes to PLATFORM account (escrow). Buyer never interacts with seller's Stripe status.
```

## Payment Lifecycle

### Step 1: Listing (No Seller-Facing Stripe)

A seller creates a listing immediately after signing up with Clerk. Nothing is gated on Stripe. The first time a listing is _published_ (`POST /api/products` with `isDraft: false`, or a draft flipped live by `PATCH /api/seller/products/[id]`), `ensureConnectAccountInBackground()` creates the connected account silently — fire-and-forget, so a Stripe outage can never fail a publish — and records the seller's terms acceptance (date, IP, user agent) from that very request. The publish button carries the consent copy that makes this acceptance real.

### Step 2: Purchase (Escrow to Platform)

When a buyer purchases, a Stripe Checkout Session or PaymentIntent is created. The payment goes to the **platform account** — not the seller. No `transfer_data` is used.

Payment includes:

- Product price
- Buyer protection fee (5% + £0.70, min £0.70 — from `packages/constants/src/checkout.ts`)
- Shipping (£4.99 Standard / £6.99 Express / £8.99 NextDay)

**Pricing model**: Buyer pays product + shipping + buyer protection fee. **Seller fee is 0%** — seller receives 100% of (product price + shipping). Platform revenue = buyer protection fee.

Key files:

- `apps/web/src/app/api/checkout/create-checkout-session/route.ts` — Stripe Checkout Session creation
- `apps/web/src/app/api/checkout/create-payment-intent/route.ts` — PaymentIntent creation
- `apps/web/src/lib/pricing.ts` — server-side pricing calculations
- `packages/constants/src/checkout.ts` — canonical shipping options and buyer protection fee calculation (shared by server and client)

### Step 3: Order Creation

When payment succeeds, an `Order` record is created linking buyer, seller, product, payment, shipping, and addresses.

- `apps/web/src/lib/create-order-from-payment-intent.ts` — order creation from PaymentIntent
- Order `paymentHoldStatus` starts as `HELD`

### Step 4: Delivery & Confirmation

When buyer confirms receipt (`POST /api/orders/[id]/confirm-receipt`):

- If seller **is onboarded** → `stripe.transfers.create()` with `source_transaction` linking to the original charge → order `paymentHoldStatus` becomes `RELEASED`
- If seller **not onboarded** → funds held as `PENDING_SELLER_ONBOARDING`

### Step 5: Auto-Release (Cron)

Daily Vercel cron (`/api/cron/release-payments`, 03:00 UTC) auto-releases orders where shipment is delivered and 14 days have passed. It re-verifies the Stripe charge isn't refunded/disputed before transferring, and claims each order atomically (`updateMany` with `paymentHoldStatus: "HELD"` in the WHERE clause) so concurrent runs can't double-pay. It also drains `PENDING_SELLER_ONBOARDING` orders for sellers who have since onboarded.

### Step 6: Deferred Transfer

When a seller's payout setup completes, the Stripe Connect `account.updated` webhook derives the status with `deriveConnectStatus()` and, once `isComplete`, triggers `processPendingTransfersForSeller()` — releasing all held funds for that seller.

## Payment Hold Statuses

`PaymentHoldStatus` enum on `Order`:

| Status                      | Meaning                                                 |
| --------------------------- | ------------------------------------------------------- |
| `HELD`                      | Funds held on platform, awaiting delivery confirmation  |
| `PENDING_SELLER_ONBOARDING` | Buyer confirmed, but seller hasn't onboarded Stripe yet |
| `RELEASED`                  | Funds transferred to seller                             |
| `DISPUTED`                  | Chargeback or dispute opened                            |
| `REFUNDED`                  | Payment refunded to buyer                               |

## Key API Routes

| Route                                                 | Purpose                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/checkout/create-checkout-session`          | Create Stripe Checkout Session (web)                                 |
| `POST /api/checkout/create-payment-intent`            | Create PaymentIntent (mobile/custom flow)                            |
| `POST /api/stripe/webhook`                            | Stripe payment webhook (checkout completed, payment failed, etc.)    |
| `POST /api/stripe/connect/webhook`                    | Stripe Connect webhook (account.updated → process pending transfers) |
| `GET /api/stripe/connect/status`                      | Unified `PayoutStatus` — the one derivation every surface reads      |
| `POST /api/stripe/connect/setup/details`              | Our own form, step 1: name, DOB, address, phone → `accounts.update`  |
| `POST /api/stripe/connect/setup/bank-account`         | Our own form, step 2: a `btok_` from client-side tokenisation        |
| `GET /api/stripe/connect/payouts`                     | Connected-account balance + recent payouts for the seller money page |
| `POST /api/stripe/connect/account`                    | AccountSession for the embedded component (verification fallback)    |
| `GET /api/stripe/connect/account`                     | Same payload as `/status`, kept for existing callers                 |
| `POST /api/stripe/connect/mobile-session`             | Mobile session token for the WebView onboarding page                 |
| `POST /api/orders/[id]/confirm-receipt`               | Buyer confirms delivery → triggers fund release                      |
| `GET /api/orders/by-session/[sessionId]`              | Order lookup by Stripe checkout session                              |
| `GET /api/orders/by-payment-intent/[paymentIntentId]` | Order lookup by PaymentIntent                                        |

## Stripe Webhooks

Two webhook endpoints handle Stripe events:

1. **Payment webhook** (`/api/stripe/webhook`): Handles checkout session completion, payment success/failure, disputes, refunds.
2. **Connect webhook** (`/api/stripe/connect/webhook`): Handles `account.updated` events — when a seller completes onboarding, this triggers `processPendingTransfersForSeller()` to release all held funds for that seller.

## Cron Jobs (Vercel)

Configured in `vercel.json`. All cron endpoints are protected by `CRON_SECRET` (bearer token).

| Endpoint                      | Schedule                       | Purpose                                           |
| ----------------------------- | ------------------------------ | ------------------------------------------------- |
| `/api/cron/release-payments`  | `0 3 * * *` (03:00 UTC daily)  | Auto-release escrowed funds 14 days post-delivery |
| `/api/cron/payment-reminders` | `0 10 * * *` (10:00 UTC daily) | Send payment reminder emails                      |
| `/api/cron/expire-offers`     | `0 6 * * *` (06:00 UTC daily)  | Expire stale offers past their `expiresAt`        |

## Security & Ownership Guards

Several ownership/visibility guards prevent unauthorized access to payment objects (BOLA protection):

| File                                             | Guard                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/checkout-session-ownership.ts` | Verifies who owns a Stripe Checkout Session                                                                      |
| `apps/web/src/lib/payment-intent-ownership.ts`   | Verifies who owns a Stripe PaymentIntent                                                                         |
| `apps/web/src/lib/payment-intent-visibility.ts`  | `create-payment-intent` uses `findFirst` (not `findUnique`), requires `isDraft: false` + `user.isDeleted: false` |

These guards are tested in:

- `tests/checkout-session-ownership.test.ts`
- `tests/payment-intent-ownership.test.ts`
- `tests/payment-intent-visibility.test.ts`

## Known Issues

The codebase review (`docs/CODEBASE_REVIEW.md`, June 2026) flagged several critical payment-domain issues. **Most were fixed on its branch** (commit "Fix critical payment, auth, and data integrity issues"): refunds/disputes now set `paymentHoldStatus` and the release cron re-verifies the charge before transferring; the Connect webhook payout drain uses per-order atomic claims + `release:${orderId}` idempotency keys; the double-sell guard detects conflicting orders and auto-refunds the duplicate buyer; mobile checkout collects shipping (Stripe Payment Sheet address collection) so orders are created from `paymentIntent.shipping`.

Deliberately deferred (still open):

- Mobile PaymentSheet shipping-collection UX (PAY-3 — ships in the app binary; webhook failures now return non-2xx so Stripe retries, making the failure loud rather than silent)
- Seller-set `DELIVERED` is not carrier-verified before the 14-day auto-release (PAY-6 — fraud/policy decision)
- Money fields are `Float` rather than integer pence (DB-1 — needs coordinated backfill; see [Data Model](data-model.md))

## Mobile Purchases

Mobile uses a different checkout flow than web:

- `apps/mobile/lib/wrapperActions.ts` — checkout flow hooks
- `apps/mobile/components/MobileCheckoutSheet.tsx` — native bottom-sheet checkout UI
- `apps/mobile/lib/stripe-safe.tsx` — graceful Stripe provider for Expo Go
- Mobile session: `apps/web/src/lib/mobile-session.ts` — JWT-based session (signed with `MOBILE_SESSION_SECRET`) for authenticating mobile API calls

## Stripe Onboarding Configuration

Stripe Connect is invisible to sellers. There is no "onboard with Stripe" step — there is a ButterGolf form.

**Account creation** (`ensureConnectAccount()` in `apps/web/src/lib/stripe-connect.ts`) happens silently on first listing publish, or on the first call to any payout route. `controller` settings:

- `stripe_dashboard: "none"` — sellers have no Stripe Dashboard
- `requirement_collection: "application"` — we collect requirements, which is what lets our terms carry the Stripe agreement and lets us set `disable_stripe_user_authentication`
- `losses: { payments: "application" }` and `fees: { payer: "application" }` — required alongside the above
- Capabilities: **`transfers` only**. Buyers pay the platform (separate charges and transfers), so sellers never take card payments; requesting `card_payments` would add requirements for a capability nobody uses.
- Country: GB, `business_type: "individual"`

**Terms acceptance** is recorded as `tos_acceptance` (date + client IP + user agent) taken from the seller's own request — the publish that created the account, and again on each details submission, since Stripe expects re-acceptance when the platform collects updated information. The consent copy sits under the publish button and section 6 of `/terms-of-service` incorporates the Stripe Connected Account Agreement.

**Collection** is ours:

- `POST /api/stripe/connect/setup/details` — validated by `validatePayoutDetails()` (`packages/constants/src/payouts.ts`), pushed via `accounts.update`. The date of birth goes to Stripe and is never stored by us; the phone, name and address are mirrored onto `User` and the default `Address`.
- `POST /api/stripe/connect/setup/bank-account` — takes a `btok_` tokenised in the client, so raw sort code and account number never reach our server. Attaching one replaces the previous default GBP bank account.

**The embedded component is a fallback only.** `POST /api/stripe/connect/account` returns an AccountSession for requirements Stripe will only accept through its own UI (identity document, proof of liveness). Callers restrict it with `collectionOptions.requirements.only` using `PayoutStatus.verificationFields`, which `classifyPayoutRequirement()` populates — anything unrecognised is routed there rather than guessed at.

**One status derivation.** `deriveConnectStatus()` (`apps/web/src/lib/stripe-connect-status.ts`, pure and unit-tested in `tests/stripe-connect-status.test.ts`) is read by `/api/stripe/connect/status`, `/api/users/seller-status`, the Connect webhook and the account route alike. `User.stripeOnboardingComplete` now means **payouts enabled + `transfers` capability active + nothing currently due** — not `details_submitted`.

**Key constraint**: 90-day fund-hold limit for non-US (GBP) platforms. `source_transaction` is used on all transfers to earmark specific charge funds.
