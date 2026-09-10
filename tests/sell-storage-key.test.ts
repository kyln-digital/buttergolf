import { describe, it, expect } from "vitest";

/**
 * The sell form persists its in-progress state to localStorage, and the hook
 * behind it syncs across tabs. Two records sharing a key therefore means two
 * tabs pushing each other's fields into one another — and then autosaving them
 * to the wrong row.
 *
 * The record-generation machinery cannot catch that: from each tab's point of
 * view the record never changed. Distinct keys are the only thing that
 * prevents it, so the derivation is pinned here.
 */
const SELL_DRAFT_STORAGE_KEY = "buttergolf-sell-draft-v1";

/** Mirrors the derivation in SellFormClient. */
function storageKeyFor({
  draftId,
  editProductId,
}: {
  draftId?: string;
  editProductId?: string;
}): string {
  return editProductId
    ? `${SELL_DRAFT_STORAGE_KEY}-edit-${editProductId}`
    : draftId
      ? `${SELL_DRAFT_STORAGE_KEY}-draft-${draftId}`
      : SELL_DRAFT_STORAGE_KEY;
}

describe("sell form storage key", () => {
  it("gives every record its own key", () => {
    const keys = [
      storageKeyFor({}),
      storageKeyFor({ draftId: "A" }),
      storageKeyFor({ draftId: "B" }),
      storageKeyFor({ editProductId: "A" }),
      storageKeyFor({ editProductId: "B" }),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not let two drafts share the new-listing key", () => {
    // The regression: only editProductId used to scope the key, so
    // /sell?draftId=A and /sell?draftId=B both landed on the bare key.
    expect(storageKeyFor({ draftId: "A" })).not.toBe(SELL_DRAFT_STORAGE_KEY);
    expect(storageKeyFor({ draftId: "A" })).not.toBe(storageKeyFor({ draftId: "B" }));
  });

  it("reserves the bare key for a brand-new listing", () => {
    // That is the one the recovery banner offers to restore, so it must not be
    // written by a resumed draft.
    expect(storageKeyFor({})).toBe(SELL_DRAFT_STORAGE_KEY);
  });

  it("keeps editing a listing separate from resuming a draft of the same id", () => {
    expect(storageKeyFor({ editProductId: "A" })).not.toBe(storageKeyFor({ draftId: "A" }));
  });
});
