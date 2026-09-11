"use client";

/**
 * One JSON call helper for admin mutations. Every /api/admin route returns
 * `{ error }` on failure, so the caller gets a message it can show as-is.
 */
export interface AdminCallResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export async function adminCall<T = unknown>(
  path: string,
  options: { method?: "POST" | "PATCH" | "DELETE" | "PUT"; body?: unknown } = {}
): Promise<AdminCallResult<T>> {
  const { method = "POST", body } = options;
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: data?.error || `Request failed (${response.status})`,
      };
    }
    return { ok: true, status: response.status, data, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
