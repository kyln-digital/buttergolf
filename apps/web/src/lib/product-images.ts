import { buildBrandedCoverUrl } from "@/lib/cloudinary";

/** Shown when a product has no images yet (e.g. a part-filled draft). */
export const PRODUCT_IMAGE_PLACEHOLDER = "/placeholder-product.jpg";

/** The shape every product-image resolver needs — Prisma rows satisfy it. */
export interface ResolvableProductImage {
  url: string;
}

/**
 * Resolves the display URL for a single product image.
 *
 * The ButterGolf cover treatment (background removed, brand pattern tiled
 * behind) belongs to whichever image is *currently* the cover, not to whichever
 * image happened to be uploaded first. Applying it at delivery time means a
 * seller reordering their photos gets a correctly branded cover immediately,
 * with no re-upload.
 *
 * Older listings have the treatment baked into the stored asset by the previous
 * upload-time transformation. Re-applying it to those is harmless and verified:
 * Cloudinary's background removal treats the tiled pattern as background and
 * the underlay puts it straight back, so the result is visually identical.
 * That's why no "already processed" flag is needed.
 */
export function resolveImageUrl(image: ResolvableProductImage, isCover: boolean): string {
  return isCover ? buildBrandedCoverUrl(image.url) : image.url;
}

/**
 * Returns the cover image URL for a product, or the placeholder when it has
 * none. `images` must already be ordered by `sortOrder` ascending.
 */
export function resolveCoverUrl(
  images: readonly ResolvableProductImage[] | null | undefined,
  placeholder: string = PRODUCT_IMAGE_PLACEHOLDER
): string {
  const cover = images?.[0];
  return cover ? resolveImageUrl(cover, true) : placeholder;
}

/**
 * Maps an ordered image list to display URLs, branding only the cover. Use for
 * galleries; preserves any other fields on each row (id, sortOrder, …).
 */
export function resolveProductImages<T extends ResolvableProductImage>(images: readonly T[]): T[] {
  return images.map((image, index) => ({
    ...image,
    url: resolveImageUrl(image, index === 0),
  }));
}
