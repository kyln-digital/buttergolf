/** Thrown by {@link readBodyWithLimit} once the stream exceeds its limit. */
export class BodyTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = "BodyTooLargeError";
  }
}

/**
 * Reads a request body into memory, giving up as soon as it passes `limit`
 * bytes rather than after the whole thing has been buffered.
 *
 * `request.arrayBuffer()` only lets a size check run afterwards, so a caller
 * who omits or forges Content-Length can make the function hold an arbitrarily
 * large body first. Counting as the stream arrives caps the memory any single
 * request can claim at `limit` plus one chunk, and cancels the stream so the
 * rest is never received.
 */
export async function readBodyWithLimit(request: Request, limit: number): Promise<Buffer> {
  const body = request.body;
  if (!body) {
    return Buffer.alloc(0);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > limit) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError(limit);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, received);
}
