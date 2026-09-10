-- Track which stored product images already have the ButterGolf brand pattern
-- baked into the asset by an upload-time Cloudinary transformation.
ALTER TABLE "product_images"
  ADD COLUMN "isBrandProcessed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: historically the transformation was applied only to the FIRST image
-- uploaded for a product (the `isFirstImage` flag on /api/upload), which is the
-- earliest-created row per product. Every other row stores the raw photo.
--
-- Note this is deliberately keyed on createdAt rather than sortOrder: a seller
-- who reordered their photos moved the baked image away from position 0, which
-- is precisely the bug this column exists to fix.
UPDATE "product_images" AS pi
SET "isBrandProcessed" = true
WHERE pi."id" = (
  SELECT inner_pi."id"
  FROM "product_images" AS inner_pi
  WHERE inner_pi."productId" = pi."productId"
  ORDER BY inner_pi."createdAt" ASC, inner_pi."id" ASC
  LIMIT 1
);
