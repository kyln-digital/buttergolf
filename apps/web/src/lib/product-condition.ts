import { ProductCondition } from "@buttergolf/db";

/** Default rating used when a seller hasn't moved a condition slider. */
export const DEFAULT_COMPONENT_CONDITION = 7;

/**
 * Maps the three component sliders (grip / head / shaft, each 1–10) onto the
 * single `ProductCondition` enum kept for backwards compatibility with older
 * listings and the browse-page filters.
 *
 * Shared by the create (POST /api/products) and update
 * (PATCH /api/seller/products/[id]) paths so an edited listing can't end up
 * with a condition that contradicts its own sliders.
 */
export function mapSlidersToConditionEnum(
  grip: number,
  head: number,
  shaft: number
): ProductCondition {
  const avg = (grip + head + shaft) / 3;
  if (avg >= 9.5) return ProductCondition.LIKE_NEW;
  if (avg >= 8) return ProductCondition.EXCELLENT;
  if (avg >= 6) return ProductCondition.GOOD;
  if (avg >= 4) return ProductCondition.FAIR;
  return ProductCondition.POOR;
}
