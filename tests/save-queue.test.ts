import { describe, it, expect } from "vitest";
import { createSaveQueue } from "../apps/web/src/app/sell/_lib/save-queue";
import {
  initialSellRecordState,
  sellRecordReducer,
  saveTarget,
} from "../apps/web/src/app/sell/_lib/sell-record-state";

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createSaveQueue", () => {
  it("runs tasks in the order they were enqueued, never overlapping", async () => {
    const queue = createSaveQueue();
    const order: string[] = [];

    const first = deferred<void>();
    const second = deferred<void>();

    const a = queue.enqueue(async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
    });
    const b = queue.enqueue(async () => {
      order.push("b:start");
      await second.promise;
      order.push("b:end");
    });

    // b must not have started while a is still in flight — this is the property
    // that stops an autosave landing after a publish.
    await Promise.resolve();
    expect(order).toEqual(["a:start"]);

    first.resolve();
    await a;
    second.resolve();
    await b;

    expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("keeps running after a task fails", async () => {
    const queue = createSaveQueue();

    const failed = queue.enqueue(async () => {
      throw new Error("network");
    });
    await expect(failed).rejects.toThrow("network");

    // A failed autosave must not wedge the queue and block the publish behind it.
    await expect(queue.enqueue(async () => "ok")).resolves.toBe("ok");
  });

  it("surfaces each task's own result to its own caller", async () => {
    const queue = createSaveQueue();

    const results = await Promise.all([
      queue.enqueue(async () => 1),
      queue.enqueue(async () => 2),
      queue.enqueue(async () => 3),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });

  it("hands a row created by one write to the next one in the queue", async () => {
    // Serialising the writes is not enough on its own: if the created row id is
    // published through React state, the next task still sees rowId === null
    // and POSTs a *second* product, leaving an orphaned draft beside the live
    // listing. The component mirrors the reducer into a ref for exactly this,
    // so the hand-off is synchronous — modelled here with the real primitives.
    const queue = createSaveQueue();
    let state = initialSellRecordState(null, "req-1");

    const applyRecordEvent = (event: Parameters<typeof sellRecordReducer>[1]) => {
      state = sellRecordReducer(state, event);
    };

    const targetsSeen: (string | null)[] = [];

    // An autosave that creates the row…
    const create = queue.enqueue(async () => {
      targetsSeen.push(saveTarget(state));
      await Promise.resolve();
      applyRecordEvent({ type: "row-created", generation: state.generation, rowId: "draft-1" });
    });

    // …and a publish queued behind it, which must update that row, not make one.
    const publish = queue.enqueue(async () => {
      targetsSeen.push(saveTarget(state));
    });

    await Promise.all([create, publish]);

    expect(targetsSeen).toEqual([null, "draft-1"]);
  });

  it("drains once every enqueued task has settled", async () => {
    const queue = createSaveQueue();
    let done = false;

    const gate = deferred<void>();
    void queue.enqueue(async () => {
      await gate.promise;
      done = true;
    });

    gate.resolve();
    await queue.drain();
    expect(done).toBe(true);
  });
});
