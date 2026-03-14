# Stripe Connect Payment Model

## Overview

ButterGolf uses **Stripe Connect** with the **Separate Charges and Transfers** pattern to implement a **low-friction marketplace escrow model**. This is one of three official Connect charge types and is explicitly designed for marketplaces where the seller may not be known — or onboarded — at the time of purchase.

**Core principle**: Stripe onboarding is never required to list or sell a product. It is only required to _receive funds_. This keeps the listing and purchasing experience completely frictionless.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SELLER JOURNEY                                   │
│                                                                         │
│  Sign Up ──→ List Product ──→ Product Sells ──→ Ship Item               │
│    (Clerk)      (No Stripe)    (No Stripe)       (No Stripe)            │
│                                                                         │
│                                         ┌─ Seller Onboarded? ─┐        │
│                                         │                      │        │
│                                     YES │                  NO  │        │
│                                         ▼                      ▼        │
│                                   Funds Transfer       Funds Held on    │
│                                   Immediately          Platform Until   │
│                                                        Seller Onboards  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        BUYER JOURNEY                                    │
│                                                                         │
│  Browse ──→ Purchase ──→ Receive Item ──→ Confirm Receipt               │
│              (Stripe        (Shipping)      (Triggers fund release)     │
│              Checkout)                                                  │
│                                                                         │
│  Payment goes to PLATFORM account (escrow). Buyer never interacts       │
│  with seller's Stripe status — it's completely invisible to them.       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stripe Connect Charge Types (Context)

Stripe Connect offers three charge models. We use #3:

| Model                              | Seller Required at Checkout? | Who Processes the Charge? | Our Use? |
| ---------------------------------- | ---------------------------- | ------------------------- | -------- |
| **Direct Charges**                 | Yes                          | Connected account         | No       |
| **Destination Charges**            | Yes (`transfer_data`)        | Platform, auto-transfers  | No       |
| **Separate Charges and Transfers** | **No**                       | **Platform (escrow)**     | **Yes**  |

With Separate Charges and Transfers:

- The charge is created on the **platform account** — no connected account is needed at charge time
- `transfer_data` is **not used** — the payment goes entirely to the platform
- `stripe.transfers.create()` is called **separately**, whenever we're ready to pay the seller
- The transfer can reference the original charge via `source_transaction` to draw from those specific funds

This is Stripe's recommended pattern for marketplaces where the recipient isn't known at payment time, or where funds need to be held in escrow.

---

## The Payment Lifecycle

### Step 1: Listing (No Stripe Required)

A seller can create a listing immediately after signing up with Clerk. There are zero Stripe checks.

**File**: [apps/web/src/app/api/products/route.ts](../apps/web/src/app/api/products/route.ts)

```
User signs up (Clerk) → Creates listing → Product visible to buyers
                         No Stripe check
```

### Step 2: Purchase (Escrow to Platform)

When a buyer purchases a product, a Stripe Embedded Checkout Session is created. The payment goes to the **platform account** — not to the seller. This is the key architectural decision.

**File**: [apps/web/src/app/api/checkout/create-checkout-session/route.ts](../apps/web/src/app/api/checkout/create-checkout-session/route.ts)

Key points:

- **No `transfer_data`** on the checkout session — payment stays on platform
- Seller's `stripeConnectId` and `stripeOnboardingComplete` are stored in metadata for later use but **do not gate the purchase**
- The checkout session includes: product price + buyer protection fee (5% + £0.70) + shipping

```typescript
// Payment stays on platform account (escrow-style)
// NO transfer_data - we'll transfer to seller after buyer confirms receipt
payment_intent_data: {
  metadata: {
    sellerStripeConnectId: seller.stripeConnectId || "",
    sellerOnboarded: seller.stripeOnboardingComplete ? "true" : "false",
    // ...
  },
},
```

### Step 3: Delivery & Receipt Confirmation

After the buyer receives their item and confirms receipt, the platform attempts to transfer funds to the seller.

**File**: [apps/web/src/app/api/orders/[id]/confirm-receipt/route.ts](../apps/web/src/app/api/orders/%5Bid%5D/confirm-receipt/route.ts)

Two outcomes:

#### 3a: Seller IS Onboarded → Immediate Transfer

```typescript
const transfer = await stripe.transfers.create({
  amount: transferAmountInPence,
  currency: "gbp",
  destination: order.seller.stripeConnectId!,
  transfer_group: order.id,
  source_transaction: order.stripeChargeId!, // Links to original charge
  // ...
});
// Order status → RELEASED
```

#### 3b: Seller NOT Onboarded → Funds Held

```typescript
await prisma.order.update({
  data: {
    paymentHoldStatus: "PENDING_SELLER_ONBOARDING",
    buyerConfirmedAt: new Date(),
  },
});
// Funds remain on platform until seller completes Stripe setup
```

### Step 4: Auto-Release (14-Day Timeout)

If the buyer doesn't confirm receipt, a daily cron job auto-releases payments 14 days after delivery confirmation.

**File**: [apps/web/src/app/api/cron/release-payments/route.ts](../apps/web/src/app/api/cron/release-payments/route.ts)

- Runs daily at 3:00 AM UTC via Vercel Cron
- Only releases orders where `shipmentStatus === "DELIVERED"` and `autoReleaseAt` has passed
- Uses optimistic locking to prevent duplicate transfers
- Rolls back to `HELD` status if the Stripe transfer fails

### Step 5: Deferred Transfer (Seller Onboards Later)

When a seller completes Stripe Connect onboarding, the `account.updated` webhook fires and triggers `processPendingTransfersForSeller()`, which finds all orders in `PENDING_SELLER_ONBOARDING` status and executes transfers.

**File**: [apps/web/src/app/api/stripe/connect/webhook/route.ts](../apps/web/src/app/api/stripe/connect/webhook/route.ts)

```typescript
// In handleAccountUpdated(), after confirming capabilities are active:
if (cardPaymentsActive && transfersActive) {
  await processPendingTransfersForSeller(user.id, account.id);
}
```

---

## Order Payment States

The `paymentHoldStatus` field on the Order model tracks the lifecycle:

```
HELD ──────────────────────────────────────────→ RELEASED
  │                                                  ▲
  │  (buyer confirms, seller not onboarded)          │
  ▼                                                  │
PENDING_SELLER_ONBOARDING ──────────────────────────┘
  │           (seller completes onboarding →
  │            webhook triggers transfer)
  │
  └──→ DISPUTED ──→ REFUNDED
```

| Status                      | Meaning                                           | Funds Location                  |
| --------------------------- | ------------------------------------------------- | ------------------------------- |
| `HELD`                      | Payment captured, awaiting buyer confirmation     | Platform account                |
| `PENDING_SELLER_ONBOARDING` | Buyer confirmed receipt, seller not yet on Stripe | Platform account                |
| `RELEASED`                  | Transfer complete, seller paid                    | Seller's Connect account        |
| `DISPUTED`                  | Buyer raised a dispute                            | Platform account (under review) |
| `REFUNDED`                  | Refund issued to buyer                            | Returned to buyer               |

---

## The `source_transaction` Parameter

All transfer creation calls use `source_transaction` to link the transfer to the original charge. This is critical for two reasons:

1. **Availability**: The transfer succeeds immediately even if the platform's available balance hasn't settled. Stripe earmarks the funds from the specific charge.
2. **Safety**: Automatic payouts to your own bank account won't drain the funds needed for seller transfers.

Without `source_transaction`, if your platform balance is low or automatic payouts are enabled, transfers can fail with an insufficient balance error.

| Transfer Location                     | Uses `source_transaction`?                  |
| ------------------------------------- | ------------------------------------------- |
| `confirm-receipt/route.ts`            | ✅ Yes — `order.stripeChargeId`             |
| `release-payments/route.ts` (cron)    | ✅ Yes — falls back to PaymentIntent lookup |
| `connect/webhook/route.ts` (deferred) | ✅ Yes — retrieved from PaymentIntent       |

---

## Pricing Model

ButterGolf uses a **Vinted-style** pricing model where the seller pays nothing and the buyer pays a protection fee:

| Component            | Who Pays | Amount                        |
| -------------------- | -------- | ----------------------------- |
| Product price        | Buyer    | Listed price                  |
| Shipping             | Buyer    | £4.99 / £6.99 / £8.99         |
| Buyer Protection Fee | Buyer    | 5% of product price + £0.70   |
| Seller fee           | —        | **0%** (seller receives 100%) |

The seller payout = product price + shipping cost. The platform revenue = buyer protection fee.

**Calculation**: [apps/web/src/lib/pricing.ts](../apps/web/src/lib/pricing.ts)

---

## Stripe Connect Onboarding

### When It's Required

| Action                             | Stripe Connect Required?             |
| ---------------------------------- | ------------------------------------ |
| Sign up                            | No                                   |
| Create listings                    | No                                   |
| Browse / view listings             | No                                   |
| Purchase a product (buyer)         | No                                   |
| Purchase when seller not onboarded | No — payment goes to platform        |
| Buyer confirms receipt             | No (for buyer)                       |
| **Seller receives payout**         | **Yes**                              |
| **Access seller dashboard**        | **Yes** — prompted to complete setup |

### How It Works

We use **Stripe Connect Embedded Components** (fully embedded onboarding) with `controller` settings for a seamless in-app experience:

**File**: [apps/web/src/app/api/stripe/connect/account/route.ts](../apps/web/src/app/api/stripe/connect/account/route.ts)

```typescript
const account = await stripe.accounts.create({
  controller: {
    stripe_dashboard: { type: "none" },
    fees: { payer: "application" },
    losses: { payments: "application" },
    requirement_collection: "application",
  },
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
  country: "GB",
  // ...
});
```

### Database Fields

The `User` model tracks Stripe Connect state:

| Field                        | Type               | Purpose                                              |
| ---------------------------- | ------------------ | ---------------------------------------------------- |
| `stripeConnectId`            | `String?` (unique) | Stripe Connect account ID (`acct_xxx`)               |
| `stripeOnboardingComplete`   | `Boolean`          | Whether all requirements are submitted               |
| `stripeAccountStatus`        | `String?`          | `active` / `restricted` / `pending` / `deauthorized` |
| `stripeAccountType`          | `String?`          | `fully_embedded` for new accounts                    |
| `stripeRequirementsDeadline` | `DateTime?`        | Deadline for outstanding requirements                |
| `stripeRequirementsDue`      | `Json?`            | Array of currently_due requirements                  |

---

## Important Constraints

### 90-Day Fund Hold Limit

For non-US platforms (we use GBP), Stripe imposes a **90-day maximum** on holding funds before transferring them to a connected account. If a seller hasn't onboarded within 90 days of payment, we need a strategy:

- **Option A**: Automatically refund the buyer
- **Option B**: Aggressively prompt the seller to onboard (email reminders)
- **Option C**: Escalate to support for manual resolution

> **US platforms** have a 2-year limit. Thailand has 10 days. All other countries: 90 days.

### Platform Liability

With Separate Charges and Transfers, the **platform is responsible for**:

- Refunds — the buyer paid the platform, not the seller
- Chargebacks — disputed charges hit the platform account
- Negative balance — if a refund/chargeback occurs after transferring to the seller

This is the tradeoff for maximum flexibility in when and how transfers happen.

### Automatic Payouts

If your Stripe platform account has automatic payouts enabled, disbursed funds could be paid out to your bank account before you transfer them to sellers. Mitigations:

- **Always use `source_transaction`** — earmarks the specific charge's funds for transfer
- Consider disabling automatic payouts if operating at scale and managing transfers manually

---

## Key Files Reference

| File                                                             | Purpose                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/web/src/lib/stripe.ts`                                     | Stripe SDK singleton                                          |
| `apps/web/src/lib/pricing.ts`                                    | Vinted-style pricing calculations                             |
| `apps/web/src/app/api/checkout/create-checkout-session/route.ts` | Creates embedded checkout (no `transfer_data`)                |
| `apps/web/src/app/api/orders/[id]/confirm-receipt/route.ts`      | Buyer confirms receipt → transfer or hold                     |
| `apps/web/src/app/api/cron/release-payments/route.ts`            | Auto-release after 14 days                                    |
| `apps/web/src/app/api/stripe/connect/account/route.ts`           | Create/retrieve Connect account + embedded onboarding session |
| `apps/web/src/app/api/stripe/connect/webhook/route.ts`           | Handle account.updated → process deferred transfers           |
| `apps/web/src/app/api/stripe/webhook/route.ts`                   | Handle checkout.session.completed → create Order              |
| `packages/db/prisma/schema.prisma`                               | User model (Stripe fields), Order model (payment states)      |

---

## Stripe Documentation References

- [Separate Charges and Transfers](https://docs.stripe.com/connect/separate-charges-and-transfers) — our core charge model
- [Connect Account Types](https://docs.stripe.com/connect/accounts) — we use fully embedded (`controller` API)
- [Embedded Onboarding](https://docs.stripe.com/connect/onboarding/quickstart) — in-app onboarding components
- [Transfer Availability](https://docs.stripe.com/connect/account-balances#transfer-availability) — `source_transaction` behaviour
- [Testing Connect](https://docs.stripe.com/connect/testing) — test account flows

---

## FAQ

**Q: Can a buyer purchase a product if the seller has never touched Stripe?**
A: Yes. The payment goes to the platform account. The seller's Stripe status is completely invisible to the buyer.

**Q: What happens to the money if the seller never onboards?**
A: Funds remain on the platform account. The seller should be prompted to complete onboarding to receive their funds. After 90 days, consider refunding the buyer or escalating.

**Q: Does the seller need to onboard before listing?**
A: No. The `SellOnboardingGate` component exists but is intentionally not used on the sell page. Sellers can list immediately.

**Q: What if a buyer requests a refund before the seller is paid?**
A: Since funds are on the platform account, the platform can issue a refund directly. No clawback from the seller is needed.

**Q: What if a buyer requests a refund after the seller is paid?**
A: The platform must fund the refund from its own balance (or reverse the transfer if Stripe supports it for the transfer type). This is the tradeoff of Separate Charges and Transfers.

**Q: Is this model officially supported by Stripe?**
A: Yes. Stripe's documentation explicitly describes this pattern: _"Charges created before the destination account is known. For example, a janitorial service could process a payment before deciding which janitor to assign to the job."_
