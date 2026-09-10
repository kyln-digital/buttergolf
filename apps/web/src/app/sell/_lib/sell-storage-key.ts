/**
 * localStorage key for the sell form's in-progress state.
 *
 * One key per record. Sharing a key across records means one record's persisted
 * draft can be read back as another's — and the record-generation machinery
 * cannot catch that, because from the form's point of view the record never
 * changed.
 *
 * v2: v1 put `/sell` and `/sell?draftId=…` on the same key. Reserving the bare
 * key for brand-new listings would otherwise make a leftover v1 value — which
 * may be a saved draft's contents — look like a new listing and get autosaved
 * as a second row. Bumping the version orphans those values instead.
 */
const SELL_DRAFT_STORAGE_PREFIX = "buttergolf-sell-draft-v2";

export interface SellStorageKeyParams {
  /** Resuming a saved draft. */
  draftId?: string;
  /** Editing a published listing. */
  editProductId?: string;
}

/** The bare key, used only for a listing that has no record yet. */
export const NEW_LISTING_STORAGE_KEY = SELL_DRAFT_STORAGE_PREFIX;

export function sellStorageKey({ draftId, editProductId }: SellStorageKeyParams): string {
  if (editProductId) return `${SELL_DRAFT_STORAGE_PREFIX}-edit-${editProductId}`;
  if (draftId) return `${SELL_DRAFT_STORAGE_PREFIX}-draft-${draftId}`;
  return NEW_LISTING_STORAGE_KEY;
}
