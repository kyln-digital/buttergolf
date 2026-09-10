/**
 * Parcel presets for golf equipment.
 *
 * Every listing needs real dimensions and weight before a carrier can quote a
 * rate or print a label. Asking sellers for four numbers gets us garbage, so
 * instead they pick the shape of the thing they're posting and we supply
 * carrier-realistic figures. Sellers can still override.
 *
 * Dimensions are the *outer packed box* in centimetres; weight is the total
 * packed weight in grams (item + box + padding). Both are what the carrier
 * charges on, not what the item alone measures.
 *
 * This package is Prisma-free and safe to import in React Native.
 */

export interface ParcelPreset {
  id: string;
  /** Shown in the picker */
  label: string;
  /** Short clarifier shown under the label */
  hint: string;
  /** Outer packed box, centimetres */
  length: number;
  width: number;
  height: number;
  /** Total packed weight, grams */
  weight: number;
}

/**
 * UK carrier limits for the services we resell (Royal Mail / Evri / DPD).
 *
 * Length is the binding constraint for golf: a driver is ~115cm shaft-to-head,
 * which is already within a hair of the 120cm cap every UK carrier applies.
 * Exceeding these doesn't fail at label purchase — it fails at the depot, as a
 * surcharge or a return, so we block it at listing time instead.
 */
export const PARCEL_LIMITS = {
  maxLengthCm: 120,
  maxWidthCm: 60,
  maxHeightCm: 60,
  /** Girth = length + 2×(width + height). Standard UK parcel rule. */
  maxGirthCm: 245,
  maxWeightG: 30_000,
  minWeightG: 50,
} as const;

export const PARCEL_PRESETS: readonly ParcelPreset[] = [
  {
    id: "club-long",
    label: "Single club — driver, wood or hybrid",
    hint: 'Long boxed club, up to 46"',
    length: 118,
    width: 20,
    height: 15,
    weight: 900,
  },
  {
    id: "club-short",
    label: "Single club — iron, wedge or putter",
    hint: "Shorter boxed club",
    length: 100,
    width: 20,
    height: 15,
    weight: 850,
  },
  {
    id: "club-part-set",
    label: "Part set — 2 to 4 clubs",
    hint: "Boxed together",
    length: 100,
    width: 25,
    height: 18,
    weight: 3000,
  },
  {
    id: "club-full-set",
    label: "Full iron set — 5 or more clubs",
    hint: "Heavy. Expect a higher rate.",
    length: 100,
    width: 30,
    height: 22,
    weight: 6500,
  },
  {
    id: "bag",
    label: "Golf bag",
    hint: "Stand, cart or carry bag",
    length: 95,
    width: 40,
    height: 35,
    weight: 4500,
  },
  {
    id: "balls",
    label: "Balls",
    hint: "A dozen or similar",
    length: 20,
    width: 15,
    height: 8,
    weight: 700,
  },
  {
    id: "apparel",
    label: "Apparel",
    hint: "Polos, trousers, waterproofs",
    length: 35,
    width: 27,
    height: 8,
    weight: 700,
  },
  {
    id: "shoes",
    label: "Shoes",
    hint: "Boxed golf shoes",
    length: 35,
    width: 25,
    height: 14,
    weight: 1300,
  },
  {
    id: "accessory-small",
    label: "Small accessory",
    hint: "Gloves, tees, towels, headcovers",
    length: 25,
    width: 20,
    height: 10,
    weight: 500,
  },
  {
    id: "accessory-medium",
    label: "Medium accessory",
    hint: "Rangefinder, trolley part, umbrella",
    length: 40,
    width: 25,
    height: 15,
    weight: 1500,
  },
  {
    id: "training-aid",
    label: "Training aid",
    hint: "Nets, mats, swing trainers",
    length: 60,
    width: 30,
    height: 20,
    weight: 2500,
  },
] as const;

/** Used when a legacy listing has no parcel data at all. Deliberately mid-sized. */
export const FALLBACK_PARCEL_PRESET_ID = "accessory-medium";

export type ParcelPresetId = (typeof PARCEL_PRESETS)[number]["id"];

export function getParcelPreset(id: string | null | undefined): ParcelPreset | undefined {
  if (!id) return undefined;
  return PARCEL_PRESETS.find((preset) => preset.id === id);
}

/**
 * Best-guess preset for a category, used to preselect in the sell flow.
 *
 * Irons deliberately default to the full set — under-declaring a 6.5kg set
 * costs far more than over-declaring a single iron.
 */
export function getDefaultParcelPresetId(categorySlug: string | null | undefined): ParcelPresetId {
  switch (categorySlug) {
    case "woods":
      // Drivers, fairway woods and hybrids are all full-length.
      return "club-long";
    case "irons":
      return "club-full-set";
    case "wedges":
    case "putters":
      return "club-short";
    case "bags":
      return "bag";
    case "balls":
      return "balls";
    case "apparel":
      return "apparel";
    case "accessories":
      return "accessory-small";
    case "training-aids":
      return "training-aid";
    default:
      return FALLBACK_PARCEL_PRESET_ID;
  }
}

export interface ParcelDimensions {
  length: number;
  width: number;
  height: number;
  weight: number;
}

export interface ParcelValidationError {
  field: "length" | "width" | "height" | "weight" | "girth";
  message: string;
}

/** Length + 2×(width + height), the standard UK carrier girth measure. */
export function calculateGirth(parcel: Omit<ParcelDimensions, "weight">): number {
  return parcel.length + 2 * (parcel.width + parcel.height);
}

/**
 * Validate a parcel against UK carrier limits.
 *
 * Runs at listing time so a seller finds out their travel bag is un-postable
 * before someone buys it, rather than at the depot after they've been paid.
 */
export function validateParcel(parcel: ParcelDimensions): ParcelValidationError[] {
  const errors: ParcelValidationError[] = [];

  // Carriers measure the longest side, so normalise before checking.
  const [longest = 0, middle = 0, shortest = 0] = [parcel.length, parcel.width, parcel.height].sort(
    (a, b) => b - a
  );

  if (!Number.isFinite(longest) || longest <= 0) {
    errors.push({ field: "length", message: "Enter a parcel length greater than 0cm" });
  } else if (longest > PARCEL_LIMITS.maxLengthCm) {
    errors.push({
      field: "length",
      message: `Longest side must be ${PARCEL_LIMITS.maxLengthCm}cm or less — UK carriers won't take it above that`,
    });
  }

  if (!Number.isFinite(middle) || middle <= 0) {
    errors.push({ field: "width", message: "Enter a parcel width greater than 0cm" });
  } else if (middle > PARCEL_LIMITS.maxWidthCm) {
    errors.push({
      field: "width",
      message: `Second-longest side must be ${PARCEL_LIMITS.maxWidthCm}cm or less`,
    });
  }

  if (!Number.isFinite(shortest) || shortest <= 0) {
    errors.push({ field: "height", message: "Enter a parcel height greater than 0cm" });
  } else if (shortest > PARCEL_LIMITS.maxHeightCm) {
    errors.push({
      field: "height",
      message: `Shortest side must be ${PARCEL_LIMITS.maxHeightCm}cm or less`,
    });
  }

  const girth = calculateGirth({ length: longest, width: middle, height: shortest });
  if (Number.isFinite(girth) && girth > PARCEL_LIMITS.maxGirthCm) {
    errors.push({
      field: "girth",
      message: `Length plus girth is ${Math.round(girth)}cm — must be ${PARCEL_LIMITS.maxGirthCm}cm or less`,
    });
  }

  if (!Number.isFinite(parcel.weight) || parcel.weight < PARCEL_LIMITS.minWeightG) {
    errors.push({
      field: "weight",
      message: `Enter a packed weight of at least ${PARCEL_LIMITS.minWeightG}g`,
    });
  } else if (parcel.weight > PARCEL_LIMITS.maxWeightG) {
    errors.push({
      field: "weight",
      message: `Packed weight must be ${PARCEL_LIMITS.maxWeightG / 1000}kg or less`,
    });
  }

  return errors;
}

/**
 * Resolve the parcel to quote and label against.
 *
 * Prefers what the seller actually declared. Falls back to the preset, then to
 * a mid-sized default for legacy listings created before parcel data existed.
 * Never returns partial data — a rate request with three real numbers and one
 * invented one is worse than one built entirely from a known preset.
 */
export function resolveParcel(product: {
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  parcelPresetId?: string | null;
  category?: { slug?: string | null } | null;
}): { parcel: ParcelDimensions; source: "declared" | "preset" | "fallback" } {
  const { length, width, height, weight } = product;

  if (length && width && height && weight) {
    return { parcel: { length, width, height, weight }, source: "declared" };
  }

  const preset =
    getParcelPreset(product.parcelPresetId) ??
    getParcelPreset(getDefaultParcelPresetId(product.category?.slug));

  if (preset) {
    return {
      parcel: {
        length: preset.length,
        width: preset.width,
        height: preset.height,
        weight: preset.weight,
      },
      source: product.parcelPresetId ? "preset" : "fallback",
    };
  }

  const fallback = getParcelPreset(FALLBACK_PARCEL_PRESET_ID)!;
  return {
    parcel: {
      length: fallback.length,
      width: fallback.width,
      height: fallback.height,
      weight: fallback.weight,
    },
    source: "fallback",
  };
}
