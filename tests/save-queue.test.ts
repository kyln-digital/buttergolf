import { describe, it, expect } from "vitest";
import { createSaveQueue } from "../apps/web/src/app/sell/_lib/save-queue";

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
