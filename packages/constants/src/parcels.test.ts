import { describe, it, expect } from "vitest";
import {
  PARCEL_PRESETS,
  PARCEL_LIMITS,
  getParcelPreset,
  getDefaultParcelPresetId,
  validateParcel,
  calculateGirth,
  resolveParcel,
  FALLBACK_PARCEL_PRESET_ID,
} from "./parcels";

describe("parcel presets", () => {
  it("has unique ids", () => {
    const ids = PARCEL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships only presets a UK carrier would actually accept", () => {
    // A preset that fails our own validation would guarantee a listing the
    // seller can never post.
    for (const preset of PARCEL_PRESETS) {
      expect(validateParcel(preset), `${preset.id} is not postable`).toEqual([]);
    }
  });

  it("keeps every club preset inside the 120cm carrier limit", () => {
    const clubPresets = PARCEL_PRESETS.filter((p) => p.id.startsWith("club-"));
    expect(clubPresets.length).toBeGreaterThan(0);
    for (const preset of clubPresets) {
      expect(preset.length).toBeLessThanOrEqual(PARCEL_LIMITS.maxLengthCm);
    }
  });

  it("sizes a driver box long enough for a real driver", () => {
    // A driver is ~115cm. The old 30cm default was the core shipping bug.
    const driver = getParcelPreset("club-long")!;
    expect(driver.length).toBeGreaterThanOrEqual(115);
  });

  it("sizes an iron set heavy enough for a real iron set", () => {
    // 8 irons at ~430g each, plus box. The old 500g default was out by ~6kg.
    const ironSet = getParcelPreset("club-full-set")!;
    expect(ironSet.weight).toBeGreaterThanOrEqual(5000);
  });
});

describe("getDefaultParcelPresetId", () => {
  it("maps each category to a preset that exists", () => {
    const slugs = [
      "woods",
      "irons",
      "wedges",
      "putters",
      "bags",
      "balls",
      "apparel",
      "accessories",
      "training-aids",
    ];
    for (const slug of slugs) {
      expect(getParcelPreset(getDefaultParcelPresetId(slug)), slug).toBeDefined();
    }
  });

  it("defaults irons to the full set, not a single club", () => {
    // Under-declaring a 6.5kg set costs more than over-declaring one iron.
    expect(getDefaultParcelPresetId("irons")).toBe("club-full-set");
  });

  it("falls back for unknown or missing categories", () => {
    expect(getDefaultParcelPresetId("not-a-category")).toBe(FALLBACK_PARCEL_PRESET_ID);
    expect(getDefaultParcelPresetId(null)).toBe(FALLBACK_PARCEL_PRESET_ID);
  });
});

describe("validateParcel", () => {
  const valid = { length: 100, width: 20, height: 15, weight: 900 };

  it("accepts a normal parcel", () => {
    expect(validateParcel(valid)).toEqual([]);
  });

  it("rejects a parcel longer than the carrier limit", () => {
    const errors = validateParcel({ ...valid, length: 150 });
    expect(errors.some((e) => e.field === "length")).toBe(true);
  });

  it("measures the longest side regardless of which field it is in", () => {
    // A seller entering 20 × 150 × 15 has still described a 150cm parcel.
    const errors = validateParcel({ length: 20, width: 150, height: 15, weight: 900 });
    expect(errors.some((e) => e.field === "length")).toBe(true);
  });

  it("rejects zero and negative dimensions", () => {
    expect(validateParcel({ ...valid, height: 0 }).length).toBeGreaterThan(0);
    expect(validateParcel({ ...valid, width: -5 }).length).toBeGreaterThan(0);
  });

  it("rejects an over-weight parcel", () => {
    const errors = validateParcel({ ...valid, weight: 40_000 });
    expect(errors.some((e) => e.field === "weight")).toBe(true);
  });

  it("rejects an implausibly light parcel", () => {
    const errors = validateParcel({ ...valid, weight: 1 });
    expect(errors.some((e) => e.field === "weight")).toBe(true);
  });

  it("rejects a parcel that busts the girth rule", () => {
    // Within every individual side limit, but far too big overall.
    const errors = validateParcel({ length: 120, width: 60, height: 60, weight: 5000 });
    expect(errors.some((e) => e.field === "girth")).toBe(true);
  });

  it("handles NaN without throwing", () => {
    expect(() => validateParcel({ ...valid, weight: Number.NaN })).not.toThrow();
    expect(validateParcel({ ...valid, weight: Number.NaN }).length).toBeGreaterThan(0);
  });
});

describe("calculateGirth", () => {
  it("is length plus twice width plus twice height", () => {
    expect(calculateGirth({ length: 100, width: 20, height: 15 })).toBe(170);
  });
});

describe("resolveParcel", () => {
  it("prefers what the seller declared", () => {
    const result = resolveParcel({ length: 90, width: 30, height: 20, weight: 4000 });
    expect(result.source).toBe("declared");
    expect(result.parcel).toEqual({ length: 90, width: 30, height: 20, weight: 4000 });
  });

  it("uses the preset when dimensions are missing", () => {
    const result = resolveParcel({ parcelPresetId: "club-long" });
    expect(result.source).toBe("preset");
    expect(result.parcel.length).toBe(getParcelPreset("club-long")!.length);
  });

  it("ignores partial dimensions rather than mixing them with a preset", () => {
    // Three real numbers plus one invented one is worse than a known preset.
    const result = resolveParcel({ length: 90, width: 30, height: 20, parcelPresetId: "bag" });
    expect(result.source).toBe("preset");
    expect(result.parcel).toEqual({
      length: getParcelPreset("bag")!.length,
      width: getParcelPreset("bag")!.width,
      height: getParcelPreset("bag")!.height,
      weight: getParcelPreset("bag")!.weight,
    });
  });

  it("falls back to the category default for legacy listings", () => {
    const result = resolveParcel({ category: { slug: "putters" } });
    expect(result.source).toBe("fallback");
    expect(result.parcel.length).toBe(getParcelPreset("club-short")!.length);
  });

  it("always returns a postable parcel, even with no information at all", () => {
    const result = resolveParcel({});
    expect(validateParcel(result.parcel)).toEqual([]);
  });
});
