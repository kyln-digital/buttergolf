import { describe, it, expect } from "vitest";
import {
  initialSellRecordState,
  sellRecordReducer,
  canSave,
  saveTarget,
  isHydrating,
  hasLoadFailed,
  canApplyWrite,
  canApplyLoad,
  type SellRecordEvent,
  type SellRecordState,
} from "../apps/web/src/app/sell/_lib/sell-record-state";

/** Applies a sequence of events, as the form would over a session. */
function run(state: SellRecordState, ...events: SellRecordEvent[]): SellRecordState {
  return events.reduce(sellRecordReducer, state);
}

const routeChange = (routeId: string | null): SellRecordEvent => ({
  type: "route-changed",
  routeId,
  createRequestId: `req-${routeId ?? "new"}`,
});

describe("initial state", () => {
  it("is immediately saveable for a fresh listing", () => {
    const state = initialSellRecordState(null, "req-1");
    expect(canSave(state)).toBe(true);
    expect(saveTarget(state)).toBeNull();
    expect(isHydrating(state)).toBe(false);
  });

  it("is not saveable for a routed record until its data arrives", () => {
    const state = initialSellRecordState("A", "req-1");
    expect(canSave(state)).toBe(false);
    expect(isHydrating(state)).toBe(true);
  });
});

describe("loading a record", () => {
  it("adopts the record as the write target once its data is on screen", () => {
    const state = run(initialSellRecordState("A", "req-1"), {
      type: "load-succeeded",
      generation: 0,
    });

    expect(canSave(state)).toBe(true);
    expect(saveTarget(state)).toBe("A");
  });

  it("stays unsaveable when the load fails, so a blank form can't overwrite it", () => {
    const state = run(initialSellRecordState("A", "req-1"), {
      type: "load-failed",
      generation: 0,
    });

    expect(hasLoadFailed(state)).toBe(true);
    expect(canSave(state)).toBe(false);
    expect(saveTarget(state)).toBeNull();
  });
});

describe("switching records", () => {
  it("drops the write target immediately, before the new record loads", () => {
    // The form still shows A's data at this point, so writing anywhere is wrong.
    const state = run(
      initialSellRecordState("A", "req-1"),
      { type: "load-succeeded", generation: 0 },
      routeChange("B")
    );

    expect(canSave(state)).toBe(false);
    expect(saveTarget(state)).toBeNull();
  });

  it("does not become saveable again by returning to a record mid-flight", () => {
    // A → B → back to A before either fetch lands. The ids match again, but A's
    // data is not necessarily on screen and the target was dropped on the way
    // through B, so a save here would create a duplicate draft.
    const state = run(
      initialSellRecordState("A", "req-1"),
      { type: "load-succeeded", generation: 0 },
      routeChange("B"),
      routeChange("A")
    );

    expect(canSave(state)).toBe(false);
    expect(saveTarget(state)).toBeNull();
  });

  it("becomes saveable again once the returned-to record actually loads", () => {
    let state = run(
      initialSellRecordState("A", "req-1"),
      { type: "load-succeeded", generation: 0 },
      routeChange("B"),
      routeChange("A")
    );
    state = sellRecordReducer(state, { type: "load-succeeded", generation: state.generation });

    expect(canSave(state)).toBe(true);
    expect(saveTarget(state)).toBe("A");
  });

  it("clears the write target and issues a fresh idempotency key when leaving for a blank form", () => {
    // Otherwise the new listing would PATCH the record just left, or its create
    // call would idempotently return that same row.
    const before = run(initialSellRecordState("A", "req-1"), {
      type: "load-succeeded",
      generation: 0,
    });
    const after = sellRecordReducer(before, routeChange(null));

    expect(saveTarget(after)).toBeNull();
    expect(canSave(after)).toBe(true); // a blank form is saveable straight away
    expect(after.createRequestId).not.toBe(before.createRequestId);
  });
});

describe("stale async results", () => {
  it("ignores a load that resolves after the form moved on", () => {
    const state = run(initialSellRecordState("A", "req-1"), routeChange("B"));
    // A's fetch finally lands, stamped with the old generation.
    const after = sellRecordReducer(state, { type: "load-succeeded", generation: 0 });

    expect(after).toBe(state);
    expect(saveTarget(after)).toBeNull();
  });

  it("ignores a row created by a save that started before the form moved on", () => {
    // A create POST from a fresh /sell form resolving after a move to ?draftId=B
    // must not point the target back at the row it made.
    const state = run(initialSellRecordState(null, "req-1"), routeChange("B"));
    const after = sellRecordReducer(state, {
      type: "row-created",
      generation: 0,
      rowId: "created-row",
    });

    expect(saveTarget(after)).toBeNull();
  });

  it("ignores a stale failure, so it can't blank an already-loaded record", () => {
    const state = run(
      initialSellRecordState("A", "req-1"),
      routeChange("B"),
      { type: "load-succeeded", generation: 1 } // B loaded
    );
    const after = sellRecordReducer(state, { type: "load-failed", generation: 0 });

    expect(after).toBe(state);
    expect(canSave(after)).toBe(true);
    expect(saveTarget(after)).toBe("B");
  });
});

describe("data and target must come from the same generation", () => {
  it("refuses a queued write whose data was captured before a record switch", () => {
    // An autosave for A sits in the queue while B loads. Reading only the
    // *current* target would PATCH B with A's fields and images.
    const capturedGeneration = 0;
    let state = run(
      initialSellRecordState("A", "req-1"),
      { type: "load-succeeded", generation: 0 },
      routeChange("B")
    );
    state = sellRecordReducer(state, { type: "load-succeeded", generation: state.generation });

    expect(canSave(state)).toBe(true); // B is perfectly saveable…
    expect(saveTarget(state)).toBe("B");
    expect(canApplyWrite(state, capturedGeneration)).toBe(false); // …but not with A's data
  });

  it("allows a queued write whose record never changed", () => {
    const state = run(initialSellRecordState("A", "req-1"), {
      type: "load-succeeded",
      generation: 0,
    });

    expect(canApplyWrite(state, state.generation)).toBe(true);
  });

  it("refuses a write while the record is mid-load, even at the same generation", () => {
    const state = initialSellRecordState("A", "req-1");
    expect(canApplyWrite(state, state.generation)).toBe(false);
  });

  it("refuses to show data from a fetch the form has moved on from", () => {
    // B's load resolving before an older A request must not let A's data reach
    // the form: the reducer would drop A's event, leaving the form showing A
    // while targeting B.
    const state = run(initialSellRecordState("A", "req-1"), routeChange("B"));

    expect(canApplyLoad(state, 0)).toBe(false);
    expect(canApplyLoad(state, state.generation)).toBe(true);
  });

  it("lets a load apply its data before the record is saveable", () => {
    // canApplyLoad is deliberately looser than canApplyWrite — the load is what
    // *makes* the record saveable.
    const state = initialSellRecordState("A", "req-1");

    expect(canSave(state)).toBe(false);
    expect(canApplyLoad(state, state.generation)).toBe(true);
  });
});

describe("creating a row for a fresh listing", () => {
  it("adopts the created row as the write target", () => {
    const state = run(initialSellRecordState(null, "req-1"), {
      type: "row-created",
      generation: 0,
      rowId: "draft-1",
    });

    expect(saveTarget(state)).toBe("draft-1");
  });

  it("never lets a second create retarget an existing row", () => {
    // Two creates racing must not leave the form writing to the later one and
    // orphaning the first.
    const state = run(
      initialSellRecordState(null, "req-1"),
      { type: "row-created", generation: 0, rowId: "draft-1" },
      { type: "row-created", generation: 0, rowId: "draft-2" }
    );

    expect(saveTarget(state)).toBe("draft-1");
  });

  it("never retargets a routed record that already loaded", () => {
    const state = run(
      initialSellRecordState("A", "req-1"),
      { type: "load-succeeded", generation: 0 },
      { type: "row-created", generation: 0, rowId: "draft-1" }
    );

    expect(saveTarget(state)).toBe("A");
  });
});
