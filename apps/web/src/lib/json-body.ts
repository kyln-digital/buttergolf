/**
 * Read a request body as a JSON object.
 *
 * Returns null for anything that isn't a JSON object: invalid JSON, an empty
 * body, `null`, arrays, strings. Route handlers turn that into a 400 rather
 * than letting `request.json()` throw into their generic 500 handler.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}
