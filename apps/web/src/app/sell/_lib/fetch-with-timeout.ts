/**
 * Saves run through a FIFO queue, so a request that never settles doesn't just
 * fail on its own — it wedges every write behind it, including the seller's
 * publish. `useAutoSave` gives up after 30s, but abandoning the promise leaves
 * the queue blocked, so the request itself has to be abandoned.
 *
 * Slightly under the autosave timeout, so the queue drains before the caller
 * stops waiting.
 */
export const SAVE_REQUEST_TIMEOUT_MS = 25_000;

export interface TimedJsonResponse {
  ok: boolean;
  status: number;
  /** Parsed body, or undefined when it was empty or not JSON. */
  data: unknown;
}

/**
 * `fetch` plus body consumption under a single timeout.
 *
 * The body matters as much as the headers: a response whose headers arrive but
 * whose body stalls would otherwise leave the queued task pending forever,
 * which is exactly the failure the timeout exists to prevent. So the timer is
 * only cleared once the body has been read.
 *
 * Note the deliberate limit: aborting here stops the *browser* waiting, not the
 * server finishing. The write may still commit after we've moved on, so this is
 * not proof the write is done — see the ordering guard in
 * PATCH /api/seller/products/[id], which is what actually protects a published
 * listing from a late autosave.
 */
export async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = SAVE_REQUEST_TIMEOUT_MS
): Promise<TimedJsonResponse> {
  const controller = new AbortController();
  const callerSignal = init.signal;

  // An already-aborted signal never fires its listener, so check up front —
  // otherwise the request would proceed despite the caller having cancelled.
  if (callerSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", forwardAbort);

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Read the body while the timer is still armed.
    const text = await response.text();

    let data: unknown;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }

    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}
