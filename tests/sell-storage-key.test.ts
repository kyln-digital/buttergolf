import { describe, it, expect } from "vitest";
import {
  sellStorageKey,
  NEW_LISTING_STORAGE_KEY,
} from "../apps/web/src/app/sell/_lib/sell-storage-key";

/**
 * The sell form persists its in-progress state to localStorage. Two records
 * sharing a key means one record's stored draft can be read back as another's,
 * and the record-generation machinery cannot catch that — from the form's point
 * of view the record never changed. So the derivation itself is the guarantee,
 * and it is imported here rather than restated, or the test would pass while
 * the component regressed.
 */
describe("sellStorageKey", () => {
  it("gives every record its own key", () => {
    const keys = [
      sellStorageKey({}),
      sellStorageKey({ draftId: "A" }),
      sellStorageKey({ draftId: "B" }),
      sellStorageKey({ editProductId: "A" }),
      sellStorageKey({ editProductId: "B" }),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not let a resumed draft share the new-listing key", () => {
    // The regression: only editProductId used to scope the key, so
    // /sell?draftId=A and /sell?draftId=B both landed on the bare key.
    expect(sellStorageKey({ draftId: "A" })).not.toBe(NEW_LISTING_STORAGE_KEY);
    expect(sellStorageKey({ draftId: "A" })).not.toBe(sellStorageKey({ draftId: "B" }));
  });

  it("reserves the bare key for a brand-new listing", () => {
    // That is the one the recovery banner offers to restore, so a resumed draft
    // must not write to it.
    expect(sellStorageKey({})).toBe(NEW_LISTING_STORAGE_KEY);
  });

  it("keeps editing a listing separate from resuming a draft of the same id", () => {
    expect(sellStorageKey({ editProductId: "A" })).not.toBe(sellStorageKey({ draftId: "A" }));
  });

  it("is namespaced past v1, so legacy shared-key values are not adopted", () => {
    // v1 put /sell and /sell?draftId=… on one key. Reading a leftover v1 value
    // as a new listing would autosave a saved draft's contents as a second row.
    expect(NEW_LISTING_STORAGE_KEY).not.toContain("-v1");
    expect(NEW_LISTING_STORAGE_KEY).toContain("-v2");
  });

  it("prefers the edit key when both ids are somehow present", () => {
    expect(sellStorageKey({ draftId: "A", editProductId: "B" })).toBe(
      sellStorageKey({ editProductId: "B" })
    );
  });
});
