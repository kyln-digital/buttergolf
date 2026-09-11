# Domain & Business Logic

ButterGolf is a peer-to-peer marketplace for used golf equipment. This page maps the business domains to their source code and explains how they work.

## Core Domains

| Domain                  | Key Files                                                                                                                                                                                                 | Description                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Listings                | `apps/web/src/app/api/products/`, `apps/web/src/app/api/listings/`, `apps/web/src/app/api/brands/`, `apps/web/src/app/api/categories/`, `apps/web/src/app/api/models/`, `packages/app/src/features/sell/` | Product creation, browsing, search, filtering          |
| Offers & Counter-Offers | `apps/web/src/app/api/conversations/`, schema: `Offer`, `CounterOffer`                                                                                                                                    | Buyer-to-seller negotiation on a product               |
| Messaging               | `apps/web/src/app/api/conversations/`, `packages/app/src/features/messages/`                                                                                                                              | Per-product buyer-seller chat threads                  |
| Orders & Escrow         | `apps/web/src/app/api/orders/`, `apps/web/src/app/api/checkout/`, `apps/web/src/lib/create-order-from-payment-intent.ts`                                                                                  | Purchase transactions with Stripe Connect escrow       |
| Shipping                | `apps/web/src/app/api/shipping/`, `apps/web/src/app/api/shipengine/`, `apps/web/src/lib/shipengine.ts`                                                                                                    | UK shipping via ShipEngine, label generation, tracking |
| Promotions              | `apps/web/src/app/api/promotions/`                                                                                                                                                                        | Paid product promotions (BUMP, PRO_SHOP_FEATURE)       |
| Favourites              | `apps/web/src/app/api/favourites/`, `packages/app/src/features/favourites/`                                                                                                                               | User product bookmarks                                 |
| Seller Onboarding       | `apps/web/src/app/api/stripe/connect/`, `apps/web/src/app/api/users/seller-status/`                                                                                                                       | Stripe Connect embedded onboarding                     |
| Auth                    | `apps/web/src/app/api/clerk/`, `packages/app/src/features/auth/`                                                                                                                                          | Clerk-based auth, webhook sync                         |
| Addresses               | `apps/web/src/app/api/addresses/`, `apps/web/src/lib/address-validation.ts`                                                                                                                               | UK shipping address management                         |

## Listings

### Product Lifecycle

A product (listing) is created by a seller via the sell flow (`packages/app/src/features/sell/sell-screen.tsx`). Products have:

- **Condition**: `NEW`, `LIKE_NEW`, `EXCELLENT`, `GOOD`, `FAIR`, `POOR` (enum `ProductCondition`)
- **Category**: One of 9 golf categories (Woods, Irons, Wedges, Putters, Bags, Balls, Apparel, Accessories, Training Aids) — defined in `packages/constants/src/categories.ts`
- **Brand & Club Model**: Normalized via `Brand` and `ClubModel` tables. `ClubModel` is unique on `[brandId, name, kind]` where `kind` is a `ClubKind` enum (DRIVER, FAIRWAY_WOOD, HYBRID, IRON_SET, WEDGE, PUTTER, BALL, BAG, APPAREL, ACCESSORY, OTHER)
- **Price**: GBP 1–10,000 (enforced by `packages/constants/src/pricing.ts`)
- **Images**: Multiple `ProductImage` records per product (sorted, cascading delete). Uploaded via Cloudinary.
- **Flex/Loft**: Golf-specific attributes on Product
- **Condition ratings**: Head/grip/shaft condition ratings (1–10 scale)
- **Draft state**: `isDraft` flag + `requestId` for idempotency (`@@unique([userId, requestId])`)

### Browsing & Search

- `/api/listings` — paginated product listings with filters
- `/api/search` — product search
- `/api/products/[id]/similar` — similar products
- `/api/categories` — category list
- `/api/brands` — brand list
- `/api/models` — club model lookup

Web pages: `/listings`, `/category/[slug]`, `/products/[id]`, `/favourites`

## Offers & Counter-Offers

Buyers can make offers on products. The offer lifecycle:

1. Buyer creates an `Offer` (`OfferStatus.PENDING`) linked to a `Product` and a `Conversation`
2. Seller can: accept (`ACCEPTED`), reject (`REJECTED`), or counter (`COUNTERED`)
3. If countered, a `CounterOffer` is created linked to the original `Offer`
4. Offers have `expiresAt` — expired offers become `EXPIRED` via the daily cron (`/api/cron/expire-offers`)
5. Accepted offers can lead to checkout

API routes under `apps/web/src/app/api/conversations/`:

- `GET/POST /api/conversations` — inbox list / start a conversation
- `POST /api/conversations/[id]/offer` — buyer makes an offer (rate-limited)
- `POST /api/conversations/[id]/offer/accept` — accept the active offer
- `POST /api/conversations/[id]/offer/counter` — counter-offer (either side, rate-limited)
- `POST /api/conversations/[id]/offer/reject` — reject the active offer
- `GET/POST /api/conversations/[id]/messages` — cursor-paginated messages (default 50, max 100)

## Messaging

Messages are scoped to `Conversation` entities. A conversation is unique per `[productId, buyerId, sellerId]` — so a buyer and seller have exactly one conversation thread per product.

- `Conversation` optionally links to an `Order` (SetNull on order deletion)
- `Message` records have a `MessageType`: `TEXT`, `OFFER`, `COUNTER_OFFER`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `OFFER_EXPIRED`, `SYSTEM`
- Messages can carry an `offerAmount` for offer-type messages
- Unread count endpoint: `/api/conversations/unread-count`
- Real-time: Supabase Realtime for web (`apps/web/src/lib/supabase-realtime.ts`); conversation broadcast helper (`apps/web/src/lib/conversation-broadcast.ts`)

## Orders & Escrow

Orders are the transaction record connecting a buyer, seller, product, and payment. See [Payments & Escrow](payments.md) for the full Stripe Connect flow.

Key fields on `Order`:

- `paymentHoldStatus`: `HELD`, `PENDING_SELLER_ONBOARDING`, `RELEASED`, `DISPUTED`, `REFUNDED`
- `status`: `PAYMENT_CONFIRMED`, `LABEL_GENERATED`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`
- Stripe payment references, ShipEngine shipping fields, addresses (from/to)
- `SellerRating` — buyer rates seller after order (unique per orderId)

Order API routes:

- `GET /api/orders` — list user's orders (as buyer or seller)
- `GET /api/orders/[id]` — order details
- `POST /api/orders/[id]/confirm-receipt` — buyer confirms delivery, triggers fund release
- `GET /api/orders/by-session/[sessionId]` — lookup by Stripe checkout session
- `GET /api/orders/by-payment-intent/[paymentIntentId]` — lookup by Stripe payment intent (can create the order as a fallback if the webhook was delayed)

## Shipping

Shipping uses **ShipEngine** (UK-focused).

- `apps/web/src/lib/shipengine.ts` (~25KB) — ShipEngine API client: rate calculation, label creation, tracking, webhook handling
- `POST /api/shipping/calculate` — calculate shipping rates for a product/destination
- `POST /api/shipengine/webhook` — ShipEngine webhook for tracking updates
- Shipping options (from `packages/constants/src/checkout.ts`): Standard (£4.99), Express (£6.99), NextDay (£8.99)
- Orders track `ShipmentStatus`: `PENDING`, `PRE_TRANSIT`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED`, `FAILED`, `CANCELLED`
- Label URLs (PNG + ZPL) stored on Order
- Address validation: `apps/web/src/lib/address-validation.ts` — UK-specific address fields

## Promotions

Sellers can pay to promote their products. Two promotion types:

- `BUMP` — boosts product visibility
- `PRO_SHOP_FEATURE` — featured placement

`ProductPromotion` has a `PromotionStatus` lifecycle: `PENDING` → `ACTIVE` → `EXPIRED`/`CANCELLED`. Paid via Stripe (separate from order payments).

API: `apps/web/src/app/api/promotions/purchase/route.ts`

## Favourites

Users can bookmark products. `Favourite` is unique on `[userId, productId]`, cascading delete when either product or user is deleted.

API: `apps/web/src/app/api/favourites/` | Web page: `/favourites` | Mobile: `packages/app/src/features/favourites/`

## Seller Onboarding

Sellers onboard with Stripe Connect **only when they need to receive funds** — never required to list or sell. Uses Stripe Connect Embedded Components with controller settings (`stripe_dashboard: "none"`, `fees: "application"`, `losses: "application"`, `requirement_collection: "application"`). Capabilities: `card_payments` + `transfers`. Country: GB.

API routes:

- `POST /api/stripe/connect/account-session` — create embedded component session
- `POST /api/stripe/connect/mobile-onboard` — mobile onboarding flow
- `POST /api/stripe/connect/mobile-session` — mobile session token
- `POST /api/stripe/connect/webhook` — Connect webhook (`account.updated` triggers pending transfer processing)
- `GET /api/users/seller-status` — check onboarding status

## Auth

Authentication uses **Clerk** (`@clerk/nextjs` for web, `@clerk/clerk-expo` for mobile).

- `POST /api/clerk/webhook` — Clerk webhook sync (user creation, updates, deletion)
- Web middleware: `apps/web/src/proxy.ts` — route protection, CORS, coming-soon mode
- Mobile: `apps/mobile/lib/apiClient.ts` — deferred fetch with secure-store token injection
- Mobile session: `apps/web/src/lib/mobile-session.ts` — JWT-based session for mobile API calls (signed with `MOBILE_SESSION_SECRET`)
- User soft-delete: `isDeleted` + `deletedAt` fields; API queries must filter `isDeleted: false`

## Images

Product images are uploaded to **Cloudinary** and stored as `ProductImage` records (URL + sort order).

- Upload endpoint: `POST /api/upload` — handles auth for both web (Clerk cookies) and mobile (Bearer tokens)
- Phone handoff: the web sell form can show a QR code ("Add photos from your phone"). It mints a 15-minute token (`apps/web/src/lib/phone-upload-session.ts`, signed with `MOBILE_SESSION_SECRET`) that the phone page `/upload-from-phone` uses as a Bearer credential against `POST /api/upload`; each upload reserves a `phone_uploads` row (under a per-session advisory lock, before Cloudinary is called) and fills it in on success, and the form polls `GET /api/upload/phone-session/[sessionId]` every 2s for filled rows. No sign-in on the phone; the allowance is capped per token and hard-capped at 10. The desktop session is kept in sessionStorage under the sell form's own draft key and cleared with it, so a reload of the same record restores it and a different record never inherits it. Publishing, saving, discarding or regenerating a code closes the session (`DELETE /api/upload/phone-session/[sessionId]`), after which the phone gets a 410; the daily `sweep-phone-uploads` cron removes rows a day old and destroys assets that never became a `ProductImage`.
- Cloudinary client: `apps/web/src/lib/cloudinary.ts`
- Placeholder image: defined in `packages/constants/src/images.ts`
- Aspect ratio: 4:3 (`PRODUCT_IMAGE_ASPECT_RATIO`)
- Sample image scripts: `scripts/upload-sample-images.ts`, `scripts/optimize-site-images.ts`
