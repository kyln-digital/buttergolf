import { describe, it, expect } from "vitest";
import { mapSlidersToConditionEnum } from "../apps/web/src/lib/product-condition";
import {
  calculateAverageCondition,
  mapConditionToEnum,
  getConditionLabel,
} from "../packages/app/src/features/sell/types";

/**
 * The server stores a single `ProductCondition` enum alongside the three
 * component sliders, and both are shown to buyers on the same product page. If
 * the server's mapping and the shared seller-flow scale disagree, a listing
 * displays a component average of "Good" next to a stored condition of FAIR.
 */
describe("mapSlidersToConditionEnum", () => {
  it("agrees with the shared seller-flow scale for every slider combination", () => {
    for (let grip = 1; grip <= 10; grip++) {
      for (let head = 1; head <= 10; head++) {
        for (let shaft = 1; shaft <= 10; shaft++) {
          expect(mapSlidersToConditionEnum(grip, head, shaft)).toBe(
            mapConditionToEnum(calculateAverageCondition(grip, head, shaft))
          );
        }
      }
    }
  });

  it("rounds the average before classifying it", () => {
    // 4/5/5 averages to 4.67. Classifying the raw average lands on FAIR, while
    // the sell form and product page both round to 5 and show "Good".
    expect(calculateAverageCondition(4, 5, 5)).toBe(5);
    expect(getConditionLabel(5)).toBe("Good");
    expect(mapSlidersToConditionEnum(4, 5, 5)).toBe("GOOD");
  });

  it("maps the ends of the scale", () => {
    expect(mapSlidersToConditionEnum(10, 10, 10)).toBe("LIKE_NEW");
    expect(mapSlidersToConditionEnum(1, 1, 1)).toBe("POOR");
  });

  it("treats the default 7/7/7 listing as GOOD, matching the label shown", () => {
    expect(mapSlidersToConditionEnum(7, 7, 7)).toBe("GOOD");
    expect(getConditionLabel(calculateAverageCondition(7, 7, 7))).toBe("Good");
  });
});
