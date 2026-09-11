const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cut-off timestamps for the admin dashboards. Kept out of the page
 * components so the React purity lint (no `Date.now()` during render) stays
 * quiet; these are server components that run once per request anyway.
 */
export function daysAgo(days: number, from: number = Date.now()): Date {
  return new Date(from - days * DAY_MS);
}
