/**
 * Checkout constants shared by web (API + display) and mobile (display).
 *
 * The server is the source of truth for what is actually charged
 * (create-payment-intent / create-checkout-session); these constants exist so
 * client-side displayed totals can never drift from server-side charged totals.
 * All amounts are integer pence.
 */

export interface ShippingOption {
  id: "standard" | "express" | "nextDay";
  name: string;
  priceInPence: number;
  /** Human-readable delivery window for display */
  days: string;
  /** Delivery estimate in business days (used for Stripe shipping_rate_data) */
  deliveryEstimate: { minBusinessDays: number; maxBusinessDays: number };
}

export const SHIPPING_OPTIONS: readonly ShippingOption[] = [
  {
    id: "standard",
    name: "Royal Mail Tracked 48",
    priceInPence: 499,
    days: "2-4 business days",
    deliveryEstimate: { minBusinessDays: 2, maxBusinessDays: 4 },
  },
  {
    id: "express",
    name: "Royal Mail Tracked 24",
    priceInPence: 699,
    days: "1-2 business days",
    deliveryEstimate: { minBusinessDays: 1, maxBusinessDays: 2 },
  },
  {
    id: "nextDay",
    name: "DPD Next Day",
    priceInPence: 899,
    days: "Next business day",
    deliveryEstimate: { minBusinessDays: 1, maxBusinessDays: 1 },
  },
] as const;

export type ShippingOptionId = ShippingOption["id"];

export function getShippingOption(id: string): ShippingOption | undefined {
  return SHIPPING_OPTIONS.find((option) => option.id === id);
}

// Buyer protection fee: (product price × 5%) + £0.70, minimum £0.70.
// Calculated on PRODUCT PRICE ONLY (shipping excluded) in both checkout flows.
export const PROTECTION_FEE_PERCENT = 5;
export const PROTECTION_FEE_FIXED_PENCE = 70;
export const PROTECTION_FEE_MINIMUM_PENCE = 70;

/**
 * Canonical buyer-protection fee calculation. Integer pence in, integer pence
 * out — every consumer (server charge math and client display math) must use
 * this exact function so totals can never diverge.
 */
export function calculateBuyerProtectionFeeInPence(productPriceInPence: number): number {
  const percentFee = Math.round(productPriceInPence * (PROTECTION_FEE_PERCENT / 100));
  const totalFee = percentFee + PROTECTION_FEE_FIXED_PENCE;
  return Math.max(totalFee, PROTECTION_FEE_MINIMUM_PENCE);
}
