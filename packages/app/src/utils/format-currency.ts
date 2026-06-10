/**
 * Shared currency formatting helpers.
 *
 * IMPORTANT: there are two monetary conventions in the codebase:
 * - Order/product amounts that are already in POUNDS (e.g. `order.amountTotal`).
 * - Seller-dashboard amounts that are stored in PENCE (e.g. `stats.totalEarnings`).
 *
 * Use `formatCurrency` for pound amounts and `formatCurrencyFromPence` for pence
 * amounts. Keeping these as two explicit functions avoids the penny/pound mix-ups
 * that previously occurred when each screen re-declared its own formatter.
 */

/** Format a value that is already expressed in pounds, e.g. 12.5 -> "£12.50". */
export function formatCurrency(amountInPounds: number): string {
  return `£${amountInPounds.toFixed(2)}`;
}

/** Format a value expressed in pence, e.g. 1250 -> "£12.50". */
export function formatCurrencyFromPence(amountInPence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amountInPence / 100);
}
