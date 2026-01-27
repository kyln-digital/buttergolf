/**
 * UK Address Validation Utilities
 *
 * Provides validation and normalisation for UK shipping addresses.
 * Used by ShipEngine integration to ensure valid addresses before API calls.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * UK Postcode regex pattern.
 * Matches formats: SW1A 1AA, SW1A1AA, M1 1AA, B33 8TH, etc.
 *
 * Format breakdown:
 * - Area: 1-2 letters (A, AB)
 * - District: 1-2 digits, optionally followed by a letter (1, 12, 1A)
 * - Space (optional)
 * - Sector: 1 digit
 * - Unit: 2 letters
 */
export const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

/**
 * UK phone number regex pattern.
 * Matches: 07xxx, +44xxx, 01xxx, 02xxx formats
 */
export const UK_PHONE_REGEX = /^(\+44\s?|0)(7\d{3}|\d{4})\s?\d{3}\s?\d{3,4}$/;

/**
 * Addresses that indicate incomplete seller setup
 */
export const INVALID_ADDRESS_MARKERS = [
  "Address pending",
  "TBD",
  "To be determined",
  "Unknown",
  "N/A",
];

// ============================================================================
// TYPES
// ============================================================================

export interface AddressValidationError {
  field: string;
  code: AddressErrorCode;
  message: string;
}

export enum AddressErrorCode {
  INVALID_POSTCODE = "INVALID_POSTCODE",
  MISSING_STREET = "MISSING_STREET",
  MISSING_CITY = "MISSING_CITY",
  MISSING_POSTCODE = "MISSING_POSTCODE",
  INCOMPLETE_ADDRESS = "INCOMPLETE_ADDRESS",
  INVALID_PHONE = "INVALID_PHONE",
  SELLER_ADDRESS_INCOMPLETE = "SELLER_ADDRESS_INCOMPLETE",
}

export interface AddressValidationResult {
  isValid: boolean;
  errors: AddressValidationError[];
  normalized?: {
    postcode: string;
    city: string;
    street1: string;
  };
}

export interface ShippingAddress {
  street1: string;
  street2?: string;
  city: string;
  state?: string; // County for UK
  zip: string; // Postcode for UK
  country?: string;
  phone?: string;
  name?: string;
}

// ============================================================================
// NORMALISATION FUNCTIONS
// ============================================================================

/**
 * Normalise a UK postcode to standard format (uppercase with space).
 *
 * @example
 * normalizeUKPostcode("sw1a1aa") → "SW1A 1AA"
 * normalizeUKPostcode("M1 1AA") → "M1 1AA"
 * normalizeUKPostcode("  b33 8th  ") → "B33 8TH"
 */
export function normalizeUKPostcode(postcode: string): string {
  // Remove all whitespace and convert to uppercase
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();

  // Insert space before last 3 characters (sector + unit)
  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }

  return cleaned;
}

/**
 * Normalise a city name (title case, trim).
 *
 * @example
 * normalizeCity("LONDON") → "London"
 * normalizeCity("  manchester  ") → "Manchester"
 */
export function normalizeCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalise a street address (trim, proper spacing).
 */
export function normalizeStreet(street: string): string {
  return street.trim().replace(/\s+/g, " ");
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a UK postcode.
 *
 * @param postcode - The postcode to validate
 * @returns true if valid UK postcode format
 */
export function isValidUKPostcode(postcode: string): boolean {
  if (!postcode) return false;
  const cleaned = postcode.replace(/\s+/g, "");
  return UK_POSTCODE_REGEX.test(cleaned);
}

/**
 * Validate a UK phone number.
 *
 * @param phone - The phone number to validate
 * @returns true if valid UK phone format
 */
export function isValidUKPhone(phone: string): boolean {
  if (!phone) return true; // Phone is optional
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  return UK_PHONE_REGEX.test(cleaned);
}

/**
 * Check if an address appears to be incomplete/pending.
 *
 * @param street1 - The street address to check
 * @returns true if address appears incomplete
 */
export function isIncompleteAddress(street1: string): boolean {
  if (!street1) return true;
  const normalized = street1.trim().toLowerCase();
  return INVALID_ADDRESS_MARKERS.some((marker) => normalized === marker.toLowerCase());
}

/**
 * Validate a complete UK shipping address.
 *
 * @param address - The address to validate
 * @param options - Validation options
 * @returns Validation result with errors and normalised values
 */
export function validateUKAddress(
  address: ShippingAddress,
  options: {
    requirePhone?: boolean;
    isSeller?: boolean;
  } = {}
): AddressValidationResult {
  const errors: AddressValidationError[] = [];

  // Check for incomplete/pending address (common for sellers)
  if (isIncompleteAddress(address.street1)) {
    errors.push({
      field: "street1",
      code: options.isSeller
        ? AddressErrorCode.SELLER_ADDRESS_INCOMPLETE
        : AddressErrorCode.INCOMPLETE_ADDRESS,
      message: options.isSeller
        ? "Please update your shipping address in Settings before selling"
        : "Please provide a complete street address",
    });
  }

  // Validate required fields
  if (!address.street1?.trim()) {
    errors.push({
      field: "street1",
      code: AddressErrorCode.MISSING_STREET,
      message: "Street address is required",
    });
  }

  if (!address.city?.trim()) {
    errors.push({
      field: "city",
      code: AddressErrorCode.MISSING_CITY,
      message: "City is required",
    });
  }

  if (!address.zip?.trim()) {
    errors.push({
      field: "zip",
      code: AddressErrorCode.MISSING_POSTCODE,
      message: "Postcode is required",
    });
  } else if (!isValidUKPostcode(address.zip)) {
    errors.push({
      field: "zip",
      code: AddressErrorCode.INVALID_POSTCODE,
      message: "Please enter a valid UK postcode (e.g., SW1A 1AA)",
    });
  }

  // Validate phone if required or provided
  if (options.requirePhone && !address.phone?.trim()) {
    errors.push({
      field: "phone",
      code: AddressErrorCode.INVALID_PHONE,
      message: "Phone number is required for delivery notifications",
    });
  } else if (address.phone && !isValidUKPhone(address.phone)) {
    errors.push({
      field: "phone",
      code: AddressErrorCode.INVALID_PHONE,
      message: "Please enter a valid UK phone number",
    });
  }

  // Return result
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Normalise valid address
  return {
    isValid: true,
    errors: [],
    normalized: {
      postcode: normalizeUKPostcode(address.zip),
      city: normalizeCity(address.city),
      street1: normalizeStreet(address.street1),
    },
  };
}

/**
 * Quick postcode-only validation for rate estimation.
 * Less strict than full address validation.
 *
 * @param postcode - The postcode to validate
 * @returns Validation result
 */
export function validatePostcodeOnly(postcode: string): {
  isValid: boolean;
  error?: AddressValidationError;
  normalized?: string;
} {
  if (!postcode?.trim()) {
    return {
      isValid: false,
      error: {
        field: "postcode",
        code: AddressErrorCode.MISSING_POSTCODE,
        message: "Postcode is required",
      },
    };
  }

  if (!isValidUKPostcode(postcode)) {
    return {
      isValid: false,
      error: {
        field: "postcode",
        code: AddressErrorCode.INVALID_POSTCODE,
        message: "Please enter a valid UK postcode (e.g., SW1A 1AA)",
      },
    };
  }

  return {
    isValid: true,
    normalized: normalizeUKPostcode(postcode),
  };
}

// ============================================================================
// SELLER VALIDATION
// ============================================================================

/**
 * Check if a seller can ship products (has valid address).
 * Used to prevent checkout for products from sellers without addresses.
 *
 * @param sellerAddress - The seller's shipping address
 * @returns Validation result with user-friendly error
 */
export function validateSellerCanShip(sellerAddress: ShippingAddress | null | undefined): {
  canShip: boolean;
  error?: {
    code: AddressErrorCode;
    message: string;
  };
} {
  if (!sellerAddress) {
    return {
      canShip: false,
      error: {
        code: AddressErrorCode.SELLER_ADDRESS_INCOMPLETE,
        message: "This seller hasn't configured their shipping address yet",
      },
    };
  }

  const validation = validateUKAddress(sellerAddress, { isSeller: true });
  if (!validation.isValid) {
    return {
      canShip: false,
      error: {
        code: AddressErrorCode.SELLER_ADDRESS_INCOMPLETE,
        message: "This seller hasn't configured their shipping address yet",
      },
    };
  }

  return { canShip: true };
}
