// Imported from the specific module rather than the package barrel: this file
// is used by API routes, and the barrel pulls in React Native components.
import {
  calculateAverageCondition,
  mapConditionToEnum,
} from "@buttergolf/app/src/features/sell/types";
import type { ProductCondition } from "@buttergolf/db";

/** Default rating used when a seller hasn't moved a condition slider. */
export const DEFAULT_COMPONENT_CONDITION = 7;

/**
 * Maps the three component sliders (grip / head / shaft, each 1–10) onto the
 * single `ProductCondition` enum kept for backwards compatibility with older
 * listings and the browse-page filters.
 *
 * Delegates to the shared seller-flow helpers so the stored enum can't disagree
 * with what the sell form and product page show. Rounding matters: sliders of
 * 4/5/5 average to 4.67, which classifying raw would store as FAIR while both
 * UIs display the rounded 5 as GOOD.
 *
 * Shared by the create (POST /api/products) and update
 * (PATCH /api/seller/products/[id]) paths.
 */
export function mapSlidersToConditionEnum(
  grip: number,
  head: number,
  shaft: number
): ProductCondition {
  return mapConditionToEnum(calculateAverageCondition(grip, head, shaft)) as ProductCondition;
}
