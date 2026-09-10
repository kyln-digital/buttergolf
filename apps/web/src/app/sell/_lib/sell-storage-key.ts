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

const TAB_ID_SESSION_KEY = `${SELL_DRAFT_STORAGE_PREFIX}-tab-id`;

/**
 * A stable id for this browser tab, from sessionStorage — which is per-tab and
 * survives reloads.
 *
 * A record-backed form can share a key across tabs safely: both are editing the
 * same row. A brand-new listing cannot. Two `/sell` tabs are two *different*
 * listings, but neither has an id yet, so a shared key means the last writer
 * wins and the other tab can hydrate those fields after a reload and autosave
 * them as its own row.
 *
 * Falls back to a per-call id when sessionStorage is unavailable (private
 * browsing, SSR): the draft simply isn't recoverable, which is the safe way to
 * fail.
 */
function tabId(): string {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.sessionStorage.getItem(TAB_ID_SESSION_KEY);
    if (existing) return existing;

    const created = Math.random().toString(36).slice(2, 10);
    window.sessionStorage.setItem(TAB_ID_SESSION_KEY, created);
    return created;
  } catch {
    return "no-session";
  }
}

/**
 * The key for a listing that has no record yet. Per-tab, so two `/sell` tabs
 * keep their own in-progress work. Recovery therefore spans reloads but not a
 * tab being closed — an acceptable trade against two tabs merging into one
 * listing, especially since autosave persists a draft server-side within
 * seconds anyway.
 */
export function newListingStorageKey(): string {
  return `${SELL_DRAFT_STORAGE_PREFIX}-new-${tabId()}`;
}

export function sellStorageKey({ draftId, editProductId }: SellStorageKeyParams): string {
  if (editProductId) return `${SELL_DRAFT_STORAGE_PREFIX}-edit-${editProductId}`;
  if (draftId) return `${SELL_DRAFT_STORAGE_PREFIX}-draft-${draftId}`;
  return newListingStorageKey();
}
