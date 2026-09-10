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

/**
 * `fetch` that aborts — and so rejects — after `timeoutMs`.
 *
 * Any `signal` already on `init` is respected too, so callers can still cancel
 * early.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = SAVE_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const callerSignal = init.signal;
  const forwardAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", forwardAbort);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}
