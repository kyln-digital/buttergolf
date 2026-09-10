/**
 * A FIFO queue for writes that must not overlap.
 *
 * The sell form has three writers — debounced autosave, "Save draft" and
 * publish — all mutating the same row. Left to race, the server orders them by
 * arrival, so an autosave dispatched earlier could land *after* a publish and
 * write back `isDraft: true` with a stale image list.
 *
 * Serialising them removes that by construction: at most one write is in flight
 * at a time, and they run in the order they were requested. Callers no longer
 * have to reason about awaiting each other.
 */
export interface SaveQueue {
  /** Runs `task` after every previously enqueued task has settled. */
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
  /** Resolves when the queue is empty. Mainly for tests. */
  drain: () => Promise<void>;
}

export function createSaveQueue(): SaveQueue {
  // The tail never rejects, so one failed save doesn't wedge the queue.
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return {
    enqueue,
    drain: () => tail.then(() => undefined),
  };
}
