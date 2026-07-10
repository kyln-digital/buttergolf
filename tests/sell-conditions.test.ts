import { describe, it, expect } from "vitest";
import {
  getConditionLabel,
  calculateAverageCondition,
  mapConditionToEnum,
  CONDITION_LABELS,
} from "../packages/app/src/features/sell/types";

describe("getConditionLabel", () => {
  it("maps known ratings to human-readable labels", () => {
    expect(getConditionLabel(1)).toBe("Poor");
    expect(getConditionLabel(2)).toBe("Poor");
    expect(getConditionLabel(3)).toBe("Fair");
    expect(getConditionLabel(4)).toBe("Fair");
    expect(getConditionLabel(5)).toBe("Good");
    expect(getConditionLabel(7)).toBe("Good");
    expect(getConditionLabel(8)).toBe("Excellent");
    expect(getConditionLabel(9)).toBe("Excellent");
    expect(getConditionLabel(10)).toBe("Like New");
  });

  it("falls back to Good for ratings outside the defined range", () => {
    expect(getConditionLabel(0)).toBe("Good");
    expect(getConditionLabel(99)).toBe("Good");
  });

  it("keeps the label table in sync with the 1-10 scale", () => {
    // Every rating 1-10 must have an entry so the sell UI never shows the
    // "Good" fallback by accident for a legitimate rating.
    for (let rating = 1; rating <= 10; rating++) {
      expect(CONDITION_LABELS[rating]).toBeDefined();
    }
  });
});

describe("calculateAverageCondition", () => {
  it("averages the three condition ratings and rounds to the nearest integer", () => {
    expect(calculateAverageCondition(10, 10, 10)).toBe(10);
    expect(calculateAverageCondition(1, 1, 1)).toBe(1);
    expect(calculateAverageCondition(10, 9, 8)).toBe(9);
    expect(calculateAverageCondition(4, 5, 6)).toBe(5);
  });

  it("rounds using Math.round semantics", () => {
    // (10 + 9 + 9) / 3 = 9.33 → 9
    expect(calculateAverageCondition(10, 9, 9)).toBe(9);
    // (8 + 8 + 9) / 3 = 8.33 → 8
    expect(calculateAverageCondition(8, 8, 9)).toBe(8);
  });
});

describe("mapConditionToEnum", () => {
  it("maps a 10 to LIKE_NEW", () => {
    expect(mapConditionToEnum(10)).toBe("LIKE_NEW");
  });

  it("maps 8-9 to EXCELLENT", () => {
    expect(mapConditionToEnum(8)).toBe("EXCELLENT");
    expect(mapConditionToEnum(9)).toBe("EXCELLENT");
  });

  it("maps 5-7 to GOOD", () => {
    expect(mapConditionToEnum(5)).toBe("GOOD");
    expect(mapConditionToEnum(7)).toBe("GOOD");
  });

  it("maps 3-4 to FAIR", () => {
    expect(mapConditionToEnum(3)).toBe("FAIR");
    expect(mapConditionToEnum(4)).toBe("FAIR");
  });

  it("maps 1-2 to POOR", () => {
    expect(mapConditionToEnum(1)).toBe("POOR");
    expect(mapConditionToEnum(2)).toBe("POOR");
  });

  it("maps the full averaged pipeline end to end", () => {
    // A pristine set of 10s averages to LIKE_NEW; a rough set to POOR.
    expect(mapConditionToEnum(calculateAverageCondition(10, 10, 10))).toBe("LIKE_NEW");
    expect(mapConditionToEnum(calculateAverageCondition(1, 2, 1))).toBe("POOR");
    expect(mapConditionToEnum(calculateAverageCondition(6, 6, 6))).toBe("GOOD");
  });
});
