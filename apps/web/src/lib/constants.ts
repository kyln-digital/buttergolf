/**
 * Application Constants
 *
 * Centralizes all magic strings, configuration values, and constants
 * used throughout the application for maintainability and consistency.
 */

// ============================================================================
// Address Validation
// ============================================================================

export const PENDING_ADDRESS = "Address pending";

// ============================================================================
// Polling Intervals
// ============================================================================

export const POLLING_INTERVALS = {
  MESSAGES: 10000, // 10 seconds
  ORDER_STATUS: 15000, // 15 seconds
} as const;

// ============================================================================
// Message Limits
// ============================================================================

export const MESSAGE_LIMITS = {
  MAX_LENGTH: 2000,
  MIN_LENGTH: 1,
} as const;

// ============================================================================
// Rating Limits
// ============================================================================

export const RATING_LIMITS = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  COMMENT_MAX_LENGTH: 500,
} as const;

// ============================================================================
// Rate Limiting
// ============================================================================

export const RATE_LIMITS = {
  MESSAGES_PER_MINUTE: 10,
  RATINGS_PER_HOUR: 5,
} as const;

// ============================================================================
// Pagination
// ============================================================================

export const MESSAGE_PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================================
// Carrier-Specific Tracking URLs
// ============================================================================

/**
 * Mapping of carrier names to tracking URL generators
 * Provides carrier-native tracking experience instead of ShipEngine proxy
 */
export const CARRIER_TRACKING_URLS: Record<string, (code: string) => string> = {
  "Royal Mail": (code) => `https://www.royalmail.com/track-your-item#/tracking-results/${code}`,
  Evri: (code) => `https://www.evri.com/track-parcel/${code}`,
  DPD: (code) => `https://www.dpd.co.uk/apps/tracking/?reference=${code}`,
  USPS: (code) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`,
  UPS: (code) => `https://www.ups.com/track?tracknum=${code}`,
  FedEx: (code) => `https://www.fedex.com/fedextrack/?trknbr=${code}`,
};

// ============================================================================
// ShipEngine Carrier Code Mapping
// ============================================================================

/**
 * Maps carrier friendly names to ShipEngine carrier codes
 * Used for tracking API calls
 */
export const SHIPENGINE_CARRIER_CODES: Record<string, string> = {
  "Royal Mail": "royal_mail",
  Evri: "evri_uk",
  DPD: "dpd_uk",
  USPS: "stamps_com",
  UPS: "ups",
  FedEx: "fedex",
};
