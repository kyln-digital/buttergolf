import { buildBrandedCoverUrl } from "@/lib/cloudinary";

/** Shown when a product has no images yet (e.g. a part-filled draft). */
export const PRODUCT_IMAGE_PLACEHOLDER = "/placeholder-product.jpg";

/**
 * The shape every product-image resolver needs. Callers pass Prisma rows
 * directly; extra fields are preserved by `resolveProductImages`.
 */
export interface ResolvableProductImage {
  url: string;
  isBrandProcessed?: boolean;
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
 * `isBrandProcessed` rows are legacy: the treatment is already baked into the
 * stored asset, so applying it again would run background removal over the
 * brand pattern itself.
 */
export function resolveImageUrl(image: ResolvableProductImage, isCover: boolean): string {
  if (!isCover || image.isBrandProcessed) {
    return image.url;
  }
  return buildBrandedCoverUrl(image.url);
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
