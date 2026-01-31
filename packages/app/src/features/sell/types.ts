/**
 * Types for the sell flow
 */

export type { ProductCondition } from "../../types/product";
import type { ProductCondition } from "../../types/product";

export interface SellFormData {
  // Step 1: Photos
  images: ImageData[];

  // Step 2: Item Details
  categoryId: string;
  categoryName: string;
  categorySlug: string; // Category slug for conditional field logic
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;

  // Golf-specific fields (conditional based on category)
  flex: string; // Shaft flex for woods/irons (L/A/R/S/X)
  loft: string; // Loft angle for woods/wedges (e.g., "10.5°")
  woodsSubcategory: string; // Driver, Fairway Wood, Hybrid (woods only)
  headCoverIncluded: boolean; // Head cover included (woods/putters)

  // Condition ratings (1-10 scale, replaces single ProductCondition enum)
  gripCondition: number; // Grip condition rating 1-10
  headCondition: number; // Head condition rating 1-10
  shaftCondition: number; // Shaft condition rating 1-10

  // Step 3: Listing Info
  title: string;
  description: string;
  price: string;
}

export interface ImageData {
  uri: string;
  width?: number;
  height?: number;
  base64?: string;
  /** Whether this image has been uploaded to CDN (vs local file URI) */
  uploaded?: boolean;
  /** True if this is the first/cover image (gets background removal) */
  isFirstImage?: boolean;
}

// Legacy condition options (for backwards compatibility with API mapping)
export const CONDITION_OPTIONS: { value: ProductCondition; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

// ============================================================================
// Golf-specific constants (shared between web and mobile)
// ============================================================================

/** Shaft flex options for woods and irons */
export const FLEX_OPTIONS = [
  { value: "", label: "Select flex (optional)" },
  { value: "L", label: "Ladies (L)" },
  { value: "A", label: "Senior (A)" },
  { value: "R", label: "Regular (R)" },
  { value: "S", label: "Stiff (S)" },
  { value: "X", label: "Extra Stiff (X)" },
] as const;

/** Loft options for woods (drivers, fairway woods, hybrids) */
export const LOFT_OPTIONS_WOODS = [
  { value: "", label: "Select loft (optional)" },
  { value: "8°", label: "8°" },
  { value: "9°", label: "9°" },
  { value: "9.5°", label: "9.5°" },
  { value: "10°", label: "10°" },
  { value: "10.5°", label: "10.5°" },
  { value: "11°", label: "11°" },
  { value: "12°", label: "12°" },
  { value: "13°", label: "13°" },
  { value: "14°", label: "14°" },
  { value: "15°", label: "15°" },
  { value: "16°", label: "16°" },
  { value: "18°", label: "18°" },
  { value: "19°", label: "19°" },
  { value: "21°", label: "21°" },
  { value: "22°", label: "22°" },
  { value: "24°", label: "24°" },
  { value: "26°", label: "26°" },
] as const;

/** Loft options for wedges */
export const LOFT_OPTIONS_WEDGES = [
  { value: "", label: "Select loft (optional)" },
  { value: "46°", label: "46°" },
  { value: "48°", label: "48°" },
  { value: "50°", label: "50°" },
  { value: "52°", label: "52°" },
  { value: "54°", label: "54°" },
  { value: "56°", label: "56°" },
  { value: "58°", label: "58°" },
  { value: "60°", label: "60°" },
  { value: "62°", label: "62°" },
  { value: "64°", label: "64°" },
] as const;

/** Woods subcategory options */
export const WOODS_SUBCATEGORIES = [
  { value: "Driver", label: "Driver" },
  { value: "Fairway Wood", label: "Fairway Wood" },
  { value: "Hybrid", label: "Hybrid" },
] as const;

/** Maps 1-10 condition rating to human-readable labels */
export const CONDITION_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Poor",
  3: "Fair",
  4: "Fair",
  5: "Good",
  6: "Good",
  7: "Good",
  8: "Excellent",
  9: "Excellent",
  10: "Like New",
};

/** Get human-readable label for a condition rating (1-10) */
export function getConditionLabel(value: number): string {
  return CONDITION_LABELS[value] ?? "Good";
}

/** Average the 3 condition ratings to determine overall condition */
export function calculateAverageCondition(grip: number, head: number, shaft: number): number {
  return Math.round((grip + head + shaft) / 3);
}

/** Map average condition rating (1-10) to ProductCondition enum */
export function mapConditionToEnum(avgRating: number): ProductCondition {
  if (avgRating >= 10) return "LIKE_NEW";
  if (avgRating >= 8) return "EXCELLENT";
  if (avgRating >= 5) return "GOOD";
  if (avgRating >= 3) return "FAIR";
  return "POOR";
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Model {
  id: string;
  name: string;
  brandId: string;
}

export type SellStep = 1 | 2 | 3 | 4;

export const SELL_STEPS = [
  { step: 1 as const, title: "Photos", description: "Add up to 5 photos" },
  {
    step: 2 as const,
    title: "Details",
    description: "Category, brand & condition",
  },
  {
    step: 3 as const,
    title: "Listing",
    description: "Title, description & price",
  },
  { step: 4 as const, title: "Review", description: "Review and submit" },
];
