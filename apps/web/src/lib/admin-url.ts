/**
 * URL helpers for the admin list pages, whose filters and pagination live in
 * the query string so views are linkable and the back button works.
 */

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export function buildAdminUrl(path: string, params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** First value of a Next.js searchParams entry, trimmed, or undefined. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/** Positive integer page number, defaulting to 1. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number.parseInt(firstParam(value) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Narrow a query value to one of a known set. */
export function enumParam<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[]
): T | undefined {
  const v = firstParam(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export const ADMIN_PAGE_SIZE = 25;

export function paginate(total: number, page: number, pageSize = ADMIN_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  return { skip: (current - 1) * pageSize, take: pageSize, totalPages, page: current };
}
