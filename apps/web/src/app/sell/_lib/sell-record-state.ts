/**
 * Record identity for the sell form.
 *
 * The form is reused across three routes — /sell (new listing), /sell?draftId=…
 * (resume a draft) and /sell/[id]/edit (edit a listing) — and Next's router
 * keeps the component mounted when only the params change. That means the
 * record under the form can change while a fetch, an autosave or a submit is
 * still in flight, and every one of those can land after the switch.
 *
 * All of that is handled here by one rule: **async work stamps itself with the
 * generation it started in, and any result whose generation no longer matches
 * is discarded.** Callers never compare ids themselves.
 */

export type SellRecordPhase =
  /** New listing. Nothing to load; saving creates the row. */
  | "blank"
  /** An existing record is being fetched. The form does not hold its data yet. */
  | "loading"
  /** The routed record's data is on screen. */
  | "ready"
  /** The fetch failed. The form does not hold the record's data. */
  | "failed";

export interface SellRecordState {
  /** Record id from the route; null when creating a fresh listing. */
  routeId: string | null;
  /**
   * The database row saves write to, or null when none exists yet. Distinct
   * from `routeId`: a fresh listing has no row until autosave creates one, and
   * a routed record has no usable row until its data has actually loaded.
   */
  rowId: string | null;
  phase: SellRecordPhase;
  /** Bumped on every record switch. Stamps async work so stale results drop. */
  generation: number;
  /** Idempotency key for creating the row. Regenerated per record. */
  createRequestId: string;
}

export type SellRecordEvent =
  /** The route now points at a different record (or at a fresh listing). */
  | { type: "route-changed"; routeId: string | null; createRequestId: string }
  /** The routed record's data has been applied to the form. */
  | { type: "load-succeeded"; generation: number }
  | { type: "load-failed"; generation: number }
  /** A save created the row this form writes to. */
  | { type: "row-created"; generation: number; rowId: string };

export function initialSellRecordState(
  routeId: string | null,
  createRequestId: string
): SellRecordState {
  return {
    routeId,
    rowId: null,
    phase: routeId ? "loading" : "blank",
    generation: 0,
    createRequestId,
  };
}

export function sellRecordReducer(state: SellRecordState, event: SellRecordEvent): SellRecordState {
  switch (event.type) {
    case "route-changed": {
      // A switch invalidates everything record-scoped. `rowId` is dropped
      // rather than pointed at the new id: the form still shows the previous
      // record's data until the load lands, so there is no safe write target
      // in between.
      return {
        routeId: event.routeId,
        rowId: null,
        phase: event.routeId ? "loading" : "blank",
        generation: state.generation + 1,
        createRequestId: event.createRequestId,
      };
    }

    case "load-succeeded": {
      if (event.generation !== state.generation) return state;
      // The data on screen is now this record's, so it becomes the write target.
      return { ...state, phase: "ready", rowId: state.routeId };
    }

    case "load-failed": {
      if (event.generation !== state.generation) return state;
      return { ...state, phase: "failed" };
    }

    case "row-created": {
      if (event.generation !== state.generation) return state;
      // Only a form with no row adopts one; a routed record already has its own.
      if (state.rowId !== null) return state;
      return { ...state, rowId: event.rowId };
    }

    default:
      return state;
  }
}

/**
 * Whether a save may run. True only when the form's contents belong to the
 * record it would write to: a fresh listing (nothing loaded, nothing to
 * contradict) or a record whose data has arrived.
 */
export function canSave(state: SellRecordState): boolean {
  return state.phase === "blank" || state.phase === "ready";
}

/** The row a save should write to; null means "create one". */
export function saveTarget(state: SellRecordState): string | null {
  return state.rowId;
}

/**
 * Whether `state` still describes the route currently rendered.
 *
 * Props change during render while the route-change effect that updates the
 * reducer is passive and runs afterwards, so for one render the state can
 * describe the record just left. That matters beyond staleness: `isEditingListing`
 * is derived straight from props, so a save in that window could send an
 * edit-mode payload against the *previous* row — dropping `isDraft: true` from
 * an autosave and unpublishing a live listing.
 */
export function matchesRoute(state: SellRecordState, currentRouteId: string | null): boolean {
  return state.routeId === currentRouteId;
}

/**
 * Whether work carrying data captured in `dataGeneration` may still be applied.
 *
 * The generation has to travel *with the payload*, not just be read when the
 * work runs. A queued autosave holds the form data it was given; if the record
 * switched while it waited, reading the current target would write the old
 * record's fields into the new one. Equally, a fetch that resolves out of order
 * must not push its data into a form that has moved on — the reducer would
 * reject its event, but the form would already be showing the wrong listing.
 *
 * Both cases are the same question: does this data still belong to the record
 * we would be acting on?
 */
export function canApplyWrite(state: SellRecordState, dataGeneration: number): boolean {
  return state.generation === dataGeneration && canSave(state);
}

/**
 * Whether data fetched in `dataGeneration` may still be shown. Looser than
 * {@link canApplyWrite}: a load applies its own data *before* the record
 * reaches a saveable phase, so only the generation matters here.
 */
export function canApplyLoad(state: SellRecordState, dataGeneration: number): boolean {
  return state.generation === dataGeneration;
}

/** The routed record is still being fetched. */
export function isHydrating(state: SellRecordState): boolean {
  return state.phase === "loading";
}

/** The routed record could not be fetched. */
export function hasLoadFailed(state: SellRecordState): boolean {
  return state.phase === "failed";
}
