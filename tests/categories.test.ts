import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  getCategoryBySlug,
  getCategoryByName,
  getCategorySlugs,
  getCategoryNames,
  isValidCategorySlug,
} from "../packages/constants/src/categories";

describe("categories", () => {
  it("defines the expected set of product categories", () => {
    expect(getCategoryNames()).toEqual([
      "Woods",
      "Irons",
      "Wedges",
      "Putters",
      "Bags",
      "Balls",
      "Apparel",
      "Accessories",
      "Training Aids",
    ]);
  });

  it("gives every category a unique slug", () => {
    const slugs = getCategorySlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("sorts categories by ascending sortOrder", () => {
    const orders = CATEGORIES.map((c) => c.sortOrder);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it("looks up a category by slug", () => {
    const woods = getCategoryBySlug("woods");
    expect(woods?.name).toBe("Woods");
    expect(woods?.imageUrl).toBe("/_assets/images/woods.webp");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getCategoryBySlug("nonexistent")).toBeUndefined();
  });

  it("looks up a category by name case-insensitively", () => {
    expect(getCategoryByName("Woods")?.slug).toBe("woods");
    expect(getCategoryByName("WOODS")?.slug).toBe("woods");
    expect(getCategoryByName("irons")?.slug).toBe("irons");
  });

  it("returns undefined for an unknown name", () => {
    expect(getCategoryByName("Nope")).toBeUndefined();
  });

  it("validates category slugs", () => {
    expect(isValidCategorySlug("putters")).toBe(true);
    expect(isValidCategorySlug("training-aids")).toBe(true);
    expect(isValidCategorySlug("not-a-category")).toBe(false);
  });
});
