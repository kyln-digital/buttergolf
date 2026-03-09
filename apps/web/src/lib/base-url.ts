/**
 * Resolve the application base URL from environment variables.
 *
 * Checked in order:
 *   1. NEXT_PUBLIC_BASE_URL  (explicit, preferred)
 *   2. NEXT_PUBLIC_APP_URL   (legacy alias)
 *   3. APP_URL               (server-only alias)
 *   4. VERCEL_URL            (auto-set by Vercel, needs https:// prefix)
 *   5. Fallback              (localhost for dev)
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
