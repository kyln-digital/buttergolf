import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "../apps/web/src/app/sell/_lib/fetch-with-timeout";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("returns the response when the request completes in time", async () => {
    const expected = new Response("ok");
    globalThis.fetch = vi.fn(async () => expected);

    await expect(fetchWithTimeout("/api/products", {}, 50)).resolves.toBe(expected);
  });

  it("rejects when the request outlives the timeout", async () => {
    // Saves are serialised, so a request that never settles blocks every write
    // behind it — including publish. It has to be abandoned, not just waited on.
    globalThis.fetch = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    ) as typeof fetch;

    await expect(fetchWithTimeout("/api/products", {}, 10)).rejects.toThrow();
  });

  it("aborts the underlying request rather than only rejecting", async () => {
    // Leaving the connection open would keep the write in flight server-side.
    let observed: AbortSignal | undefined;
    globalThis.fetch = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          observed = init?.signal ?? undefined;
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    ) as typeof fetch;

    await expect(fetchWithTimeout("/api/products", {}, 10)).rejects.toThrow();
    expect(observed?.aborted).toBe(true);
  });

  it("still honours a caller's own abort signal", async () => {
    const caller = new AbortController();
    globalThis.fetch = vi.fn(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    ) as typeof fetch;

    const pending = fetchWithTimeout("/api/products", { signal: caller.signal }, 10_000);
    caller.abort();

    await expect(pending).rejects.toThrow();
  });
});
