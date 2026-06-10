-- Review hardening: idempotency unique constraints + composite indexes for hot query paths.
-- NOTE: the CREATE UNIQUE INDEX statements will fail if existing rows violate them
-- (e.g. duplicate stripePaymentId on product_promotions). Review/clean data on
-- staging before applying to production.

-- Replace the single-column requestId index with a per-user idempotency unique
DROP INDEX IF EXISTS "products_requestId_idx";
CREATE UNIQUE INDEX "products_userId_requestId_key" ON "products"("userId", "requestId");

-- Order: one order per Stripe identifier (idempotency / duplicate-payout protection)
CREATE UNIQUE INDEX "orders_stripeCheckoutId_key" ON "orders"("stripeCheckoutId");
CREATE UNIQUE INDEX "orders_stripeTransferId_key" ON "orders"("stripeTransferId");
CREATE UNIQUE INDEX "orders_stripeChargeId_key" ON "orders"("stripeChargeId");

-- Promotion: one promotion row per payment (prevents duplicate paid promotions)
CREATE UNIQUE INDEX "product_promotions_stripePaymentId_key" ON "product_promotions"("stripePaymentId");

-- Composite indexes for known access patterns
CREATE INDEX "products_categoryId_isSold_idx" ON "products"("categoryId", "isSold");
CREATE INDEX "orders_buyerId_status_idx" ON "orders"("buyerId", "status");
CREATE INDEX "orders_sellerId_status_idx" ON "orders"("sellerId", "status");
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");
