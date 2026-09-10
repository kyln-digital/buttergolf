import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJsonWithTimeout } from "../apps/web/src/app/sell/_lib/fetch-with-timeout";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** A fetch that never settles unless its signal aborts. */
function hangingFetch(onCall?: (init?: RequestInit) => void) {
  return vi.fn(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        onCall?.(init ?? undefined);
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })
  ) as typeof fetch;
}

describe("fetchJsonWithTimeout", () => {
  it("returns the parsed body when the request completes in time", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "draft-1" })));

    await expect(fetchJsonWithTimeout("/api/products", {}, 50)).resolves.toEqual({
      ok: true,
      status: 200,
      data: { id: "draft-1" },
    });
  });

  it("reports failures without throwing, so callers can read the error body", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: "nope" }), { status: 400 })
    );

    const result = await fetchJsonWithTimeout("/api/products", {}, 50);
    expect(result.ok).toBe(false);
    expect(result.data).toEqual({ error: "nope" });
  });

  it("tolerates an empty or non-JSON body", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not json", { status: 200 }));

    await expect(fetchJsonWithTimeout("/api/products", {}, 50)).resolves.toMatchObject({
      ok: true,
      data: undefined,
    });
  });

  it("aborts the request when it outlives the timeout", async () => {
    // Saves are serialised, so a request that never settles blocks every later
    // write including publish. It has to be abandoned, not merely awaited.
    let observed: AbortSignal | undefined;
    globalThis.fetch = hangingFetch((init) => {
      observed = init?.signal ?? undefined;
    });

    await expect(fetchJsonWithTimeout("/api/products", {}, 10)).rejects.toThrow();
    expect(observed?.aborted).toBe(true);
  });

  it("keeps the timeout armed while the body is being read", async () => {
    // Headers arriving is not the same as the request finishing: a stalled body
    // would leave the queued task pending despite the timeout.
    globalThis.fetch = vi.fn(
      async (_input, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
              // Never enqueue or close — the body simply stalls.
            },
          })
        )
    ) as typeof fetch;

    await expect(fetchJsonWithTimeout("/api/products", {}, 20)).rejects.toThrow();
  });

  it("respects a caller signal that is already aborted", async () => {
    // Adding a listener to an aborted signal never fires it, so without an
    // explicit check the request would go out despite being cancelled.
    const caller = AbortSignal.abort();
    const spy = hangingFetch();
    globalThis.fetch = spy;

    await expect(
      fetchJsonWithTimeout("/api/products", { signal: caller }, 10_000)
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it("still honours a caller signal aborted after the request starts", async () => {
    const caller = new AbortController();
    globalThis.fetch = hangingFetch();

    const pending = fetchJsonWithTimeout("/api/products", { signal: caller.signal }, 10_000);
    caller.abort();

    await expect(pending).rejects.toThrow();
  });
});
