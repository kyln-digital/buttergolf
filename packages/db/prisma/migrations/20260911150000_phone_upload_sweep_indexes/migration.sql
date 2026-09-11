-- DropIndex
-- Served the per-seller sweep that ran when a code was minted; the sweep is
-- now a daily cron over the whole table, so the index has no reader.
DROP INDEX "phone_uploads_clerkId_createdAt_idx";

-- CreateIndex
-- The daily sweep selects and orders phone_uploads by age alone.
CREATE INDEX "phone_uploads_createdAt_idx" ON "phone_uploads"("createdAt");

-- CreateIndex
-- The sweep asks "does any listing still use this asset?" by URL before
-- destroying it, and product_images had no index on url.
CREATE INDEX "product_images_url_idx" ON "product_images"("url");
