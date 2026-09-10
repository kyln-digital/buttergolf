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
  /**
   * Carrier name fragments this option should buy from, best match first.
   * Matched case-insensitively against the carrier on each quoted rate.
   *
   * We match on carrier + speed rather than a ShipEngine service_code because
   * service codes differ between the sandbox and production carrier sets, and
   * change when a carrier account is swapped. Speed is the promise we actually
   * made the buyer; the carrier is a preference.
   */
  preferredCarriers: readonly string[];
  /**
   * Hard ceiling on a quoted rate's delivery_days. A rate slower than this
   * cannot satisfy this option — we promised the buyer a delivery window and
   * buying a slower label silently breaks it.
   */
  maxDeliveryDays: number;
}

export const SHIPPING_OPTIONS: readonly ShippingOption[] = [
  {
    id: "standard",
    name: "Royal Mail Tracked 48",
    priceInPence: 499,
    days: "2-4 business days",
    deliveryEstimate: { minBusinessDays: 2, maxBusinessDays: 4 },
    preferredCarriers: ["royal mail", "evri"],
    maxDeliveryDays: 4,
  },
  {
    id: "express",
    name: "Royal Mail Tracked 24",
    priceInPence: 699,
    days: "1-2 business days",
    deliveryEstimate: { minBusinessDays: 1, maxBusinessDays: 2 },
    preferredCarriers: ["royal mail", "dpd"],
    maxDeliveryDays: 2,
  },
  {
    id: "nextDay",
    name: "DPD Next Day",
    priceInPence: 899,
    days: "Next business day",
    deliveryEstimate: { minBusinessDays: 1, maxBusinessDays: 1 },
    preferredCarriers: ["dpd", "royal mail"],
    maxDeliveryDays: 1,
  },
] as const;

export type ShippingOptionId = ShippingOption["id"];

export function getShippingOption(id: string): ShippingOption | undefined {
  return SHIPPING_OPTIONS.find((option) => option.id === id);
}

/**
 * Rank a quoted carrier against an option's carrier preference.
 * Lower is better; `preferredCarriers.length` means "no preference matched".
 */
export function rankCarrierPreference(option: ShippingOption, carrierName: string): number {
  const normalised = carrierName.toLowerCase();
  const index = option.preferredCarriers.findIndex((fragment) => normalised.includes(fragment));
  return index === -1 ? option.preferredCarriers.length : index;
}

/**
 * The subset of a carrier rate that service selection needs. Structural, so
 * a ShipEngine rate object satisfies it without this package depending on
 * ShipEngine (or on anything else).
 */
export interface SelectableRate {
  carrier_friendly_name: string;
  service_type: string;
  shipping_amount: { amount: number };
  delivery_days: number | null;
}

/**
 * Pick the rate to buy for the service the buyer paid for.
 *
 * The buyer chose a delivery window and was charged for it, so a rate slower
 * than that window is not a valid substitute however cheap it is — that is how
 * someone paying £8.99 for next-day used to end up with an Evri economy label.
 *
 * Ordering within the eligible set: carrier preference first (an option named
 * "Royal Mail Tracked 24" should buy Royal Mail where it can), then price.
 * Rates with no `delivery_days` stay eligible — ShipEngine omits it for some
 * services and refusing to ship at all is worse than an unverified window —
 * but they always rank behind rates that provably meet it.
 *
 * Returns null when nothing meets the window, which is a real failure worth
 * surfacing rather than papering over.
 */
export function selectRateForOption<T extends SelectableRate>(
  rates: readonly T[],
  option: ShippingOption | undefined
): T | null {
  const byPrice = [...rates].sort((a, b) => a.shipping_amount.amount - b.shipping_amount.amount);

  // Legacy orders placed before we recorded the chosen option.
  if (!option) return byPrice[0] ?? null;

  const eligible = byPrice.filter(
    (rate) => rate.delivery_days == null || rate.delivery_days <= option.maxDeliveryDays
  );

  if (eligible.length === 0) return null;

  return (
    eligible.sort((a, b) => {
      const aVerified = a.delivery_days != null ? 0 : 1;
      const bVerified = b.delivery_days != null ? 0 : 1;
      if (aVerified !== bVerified) return aVerified - bVerified;

      const aCarrier = rankCarrierPreference(option, a.carrier_friendly_name ?? "");
      const bCarrier = rankCarrierPreference(option, b.carrier_friendly_name ?? "");
      if (aCarrier !== bCarrier) return aCarrier - bCarrier;

      return a.shipping_amount.amount - b.shipping_amount.amount;
    })[0] ?? null
  );
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
