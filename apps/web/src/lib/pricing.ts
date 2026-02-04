/**
 * Vinted-style Buyer Protection Fee Calculator
 *
 * Fee structure:
 * - 5% of product price
 * - Plus £0.70 fixed fee
 * - Minimum £0.70 total
 *
 * Sellers receive 100% of product price + shipping (0% platform fee)
 * Platform revenue comes from buyer protection fees + optional promotions
 */

// Fee configuration (amounts in pence for precision)
const PROTECTION_FEE_PERCENT = 5; // 5%
const PROTECTION_FEE_FIXED_PENCE = 70; // £0.70
const PROTECTION_FEE_MINIMUM_PENCE = 70; // £0.70 minimum

// Auto-release configuration
export const AUTO_RELEASE_DAYS = 14; // Days after delivery before auto-release

// Promotion prices (in pence)
export const PROMOTION_PRICES = {
  BUMP: 99, // £0.99
  PRO_SHOP_FEATURE: 499, // £4.99
} as const;

// Promotion durations (in milliseconds)
export const PROMOTION_DURATIONS = {
  BUMP: 24 * 60 * 60 * 1000, // 24 hours
  PRO_SHOP_FEATURE: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

export interface PricingBreakdown {
  // Input values (in pounds)
  productPrice: number;
  shippingCost: number;
  // Calculated fees (in pounds)
  buyerProtectionFee: number;
  // Totals (in pounds)
  totalBuyerPays: number;
  sellerReceives: number;
  platformRevenue: number;
}

export interface PricingBreakdownInPence {
  productPriceInPence: number;
  shippingCostInPence: number;
  buyerProtectionFeeInPence: number;
  totalBuyerPaysInPence: number;
  sellerReceivesInPence: number;
}

/**
 * Calculate buyer protection fee in pence
 *
 * IMPORTANT: Fee is calculated on PRODUCT PRICE ONLY, not including shipping.
 * This is consistent across both checkout flows:
 * - EmbeddedCheckout: Protection fee calculated before shipping is known
 * - PaymentElement: Protection fee calculated with known shipping but excludes it
 *
 * This design decision ensures:
 * 1. Fee is predictable for buyers regardless of shipping option chosen
 * 2. Sellers aren't penalized for higher shipping costs
 * 3. Calculation matches what's shown to buyers before checkout
 *
 * Formula: (productPrice × 5%) + £0.70, minimum £0.70
 */
export function calculateBuyerProtectionFeeInPence(productPriceInPence: number): number {
  const percentFee = Math.round(productPriceInPence * (PROTECTION_FEE_PERCENT / 100));
  const totalFee = percentFee + PROTECTION_FEE_FIXED_PENCE;
  return Math.max(totalFee, PROTECTION_FEE_MINIMUM_PENCE);
}

/**
 * Calculate buyer protection fee in pounds
 */
export function calculateBuyerProtectionFee(productPrice: number): number {
  const productPriceInPence = Math.round(productPrice * 100);
  return calculateBuyerProtectionFeeInPence(productPriceInPence) / 100;
}

/**
 * Get full pricing breakdown for display (amounts in pounds)
 */
export function calculatePricingBreakdown(
  productPrice: number,
  shippingCost: number
): PricingBreakdown {
  const buyerProtectionFee = calculateBuyerProtectionFee(productPrice);

  return {
    productPrice,
    shippingCost,
    buyerProtectionFee,
    totalBuyerPays: productPrice + shippingCost + buyerProtectionFee,
    sellerReceives: productPrice + shippingCost, // 100% to seller
    platformRevenue: buyerProtectionFee,
  };
}

/**
 * Get pricing breakdown in pence for Stripe API calls
 */
export function calculatePricingBreakdownInPence(
  productPriceInPence: number,
  shippingCostInPence: number
): PricingBreakdownInPence {
  const buyerProtectionFeeInPence = calculateBuyerProtectionFeeInPence(productPriceInPence);

  return {
    productPriceInPence,
    shippingCostInPence,
    buyerProtectionFeeInPence,
    totalBuyerPaysInPence: productPriceInPence + shippingCostInPence + buyerProtectionFeeInPence,
    sellerReceivesInPence: productPriceInPence + shippingCostInPence, // 100%
  };
}

/**
 * Calculate auto-release date from delivery date
 */
export function calculateAutoReleaseDate(deliveryDate?: Date): Date {
  const baseDate = deliveryDate || new Date();
  const autoReleaseDate = new Date(baseDate);
  autoReleaseDate.setDate(autoReleaseDate.getDate() + AUTO_RELEASE_DAYS);
  return autoReleaseDate;
}

/**
 * Format price for display (e.g., "£5.70")
 */
export function formatPrice(amountInPounds: number): string {
  return `£${amountInPounds.toFixed(2)}`;
}

/**
 * Format price from pence for display
 */
export function formatPriceFromPence(amountInPence: number): string {
  return formatPrice(amountInPence / 100);
}
