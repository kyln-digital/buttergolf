-- Migration: add-conversation-model
-- Introduces Conversation model, MessageType enum, and migrates existing data.
-- Strategy: add columns nullable → create conversations from existing data → backfill → make NOT NULL

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'OFFER', 'COUNTER_OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_EXPIRED', 'SYSTEM');

-- CreateTable (conversations must exist before we can reference it)
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_orderId_key" ON "conversations"("orderId");
CREATE INDEX "conversations_productId_idx" ON "conversations"("productId");
CREATE INDEX "conversations_buyerId_idx" ON "conversations"("buyerId");
CREATE INDEX "conversations_sellerId_idx" ON "conversations"("sellerId");
CREATE INDEX "conversations_orderId_idx" ON "conversations"("orderId");
CREATE UNIQUE INDEX "conversations_productId_buyerId_sellerId_key" ON "conversations"("productId", "buyerId", "sellerId");

-- AddForeignKeys for conversations
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 1: Add columns as NULLABLE first
ALTER TABLE "messages" ADD COLUMN "conversationId" TEXT,
ADD COLUMN "offerAmount" DOUBLE PRECISION,
ADD COLUMN "offerId" TEXT,
ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'TEXT';

ALTER TABLE "offers" ADD COLUMN "conversationId" TEXT;

-- Step 2: Create conversations from existing Orders that have messages
INSERT INTO "conversations" ("id", "productId", "buyerId", "sellerId", "orderId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  o."productId",
  o."buyerId",
  o."sellerId",
  o."id",
  o."createdAt",
  o."updatedAt"
FROM "orders" o
WHERE EXISTS (SELECT 1 FROM "messages" m WHERE m."orderId" = o."id")
ON CONFLICT ("productId", "buyerId", "sellerId") DO NOTHING;

-- Step 3: Backfill conversationId on existing messages from their order's conversation
UPDATE "messages" m
SET "conversationId" = c."id"
FROM "conversations" c
WHERE c."orderId" = m."orderId"
  AND m."conversationId" IS NULL;

-- Step 4: Create conversations from existing Offers that don't already have one
INSERT INTO "conversations" ("id", "productId", "buyerId", "sellerId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  o."productId",
  o."buyerId",
  o."sellerId",
  o."createdAt",
  o."updatedAt"
FROM "offers" o
ON CONFLICT ("productId", "buyerId", "sellerId") DO NOTHING;

-- Step 5: Backfill conversationId on existing offers
UPDATE "offers" o
SET "conversationId" = c."id"
FROM "conversations" c
WHERE c."productId" = o."productId"
  AND c."buyerId" = o."buyerId"
  AND c."sellerId" = o."sellerId"
  AND o."conversationId" IS NULL;

-- Step 6: For any orphaned messages still without conversationId (shouldn't happen, but safety net)
-- Delete them rather than leave broken FK references
DELETE FROM "messages" WHERE "conversationId" IS NULL;

-- Step 7: Make columns NOT NULL now that all existing data is backfilled
ALTER TABLE "messages" ALTER COLUMN "conversationId" SET NOT NULL;
ALTER TABLE "offers" ALTER COLUMN "conversationId" SET NOT NULL;

-- Step 8: Make orderId optional on messages
ALTER TABLE "messages" ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateIndexes for new columns
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");
CREATE INDEX "messages_offerId_idx" ON "messages"("offerId");
CREATE INDEX "offers_conversationId_idx" ON "offers"("conversationId");

-- AddForeignKeys for messages
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for offers
ALTER TABLE "offers" ADD CONSTRAINT "offers_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
