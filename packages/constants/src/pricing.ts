/**
 * Listing price limits in GBP.
 *
 * Used by sell/edit UIs and API validation to keep listing prices in a
 * sensible range and prevent accidental extreme values.
 */
export const LISTING_PRICE_LIMITS = {
  MIN: 1,
  MAX: 10000,
} as const;

export function getListingPriceBoundsMessage(): string {
  return `Price must be between GBP ${LISTING_PRICE_LIMITS.MIN} and GBP ${LISTING_PRICE_LIMITS.MAX}.`;
}
