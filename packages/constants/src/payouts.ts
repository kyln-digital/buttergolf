/**
 * Seller payout setup — shared types and pure validators.
 *
 * ButterGolf collects a seller's payout details in its own UI (web and mobile)
 * and pushes them to Stripe via the API, so the seller never sees a Stripe
 * form. These types are the contract between:
 *
 *   - the web API routes under /api/stripe/connect/*
 *   - the shared PayoutSetupScreen in @buttergolf/app
 *   - the unit tests in /tests
 *
 * Keep this file dependency-free: it is imported by React Native.
 */

// ---------------------------------------------------------------------------
// Status DTO (what /api/stripe/connect/status returns)
// ---------------------------------------------------------------------------

/**
 * Coarse account state for badges and gating.
 *
 * - `none`        no Connect account exists yet
 * - `pending`     details or verification still outstanding, no deadline missed
 * - `active`      payouts enabled, transfers active, nothing currently due
 * - `restricted`  a Stripe deadline has passed; payouts are paused until fixed
 * - `rejected`    Stripe has rejected the account
 */
export type PayoutAccountStatus = "none" | "pending" | "active" | "restricted" | "rejected";

export interface PayoutBankAccountSummary {
  bankName: string | null;
  last4: string;
  /** Sort code as Stripe reports it, e.g. "10-88-00". */
  sortCode: string | null;
  accountHolderName: string | null;
}

export interface PayoutRequirementError {
  requirement: string;
  code: string;
  reason: string;
}

export interface PayoutRequirements {
  currentlyDue: string[];
  pastDue: string[];
  eventuallyDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
  /** ISO timestamp, or null when Stripe has set no deadline. */
  currentDeadline: string | null;
  errors: PayoutRequirementError[];
}

export interface PayoutAddressInput {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
}

export interface PayoutPrefill {
  firstName: string;
  lastName: string;
  /** E.164, or null when we have no number on file. */
  phone: string | null;
  address: PayoutAddressInput | null;
  /** Stripe already holds a date of birth, so the form need not ask again. */
  hasDob: boolean;
}

export interface PayoutStatus {
  hasAccount: boolean;
  status: PayoutAccountStatus;
  /** payouts_enabled && transfers capability active && nothing currently due. */
  isComplete: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  requirements: PayoutRequirements;
  /** Our details step (name, DOB, address, phone, terms) has fields outstanding. */
  needsDetails: boolean;
  /** Stripe has no bank account to pay out to. */
  needsBankAccount: boolean;
  /** Stripe wants something only its own UI can collect (ID document, selfie). */
  needsVerification: boolean;
  /** The requirement names to pass to the embedded component's `requirements.only`. */
  verificationFields: string[];
  bankAccount: PayoutBankAccountSummary | null;
  prefill: PayoutPrefill;
}

export const EMPTY_PAYOUT_REQUIREMENTS: PayoutRequirements = {
  currentlyDue: [],
  pastDue: [],
  eventuallyDue: [],
  pendingVerification: [],
  disabledReason: null,
  currentDeadline: null,
  errors: [],
};

/** Status for a user with no Connect account yet. */
export function noPayoutAccountStatus(prefill: PayoutPrefill): PayoutStatus {
  return {
    hasAccount: false,
    status: "none",
    isComplete: false,
    payoutsEnabled: false,
    transfersActive: false,
    requirements: EMPTY_PAYOUT_REQUIREMENTS,
    needsDetails: true,
    needsBankAccount: true,
    needsVerification: false,
    verificationFields: [],
    bankAccount: null,
    prefill,
  };
}

// ---------------------------------------------------------------------------
// Form inputs
// ---------------------------------------------------------------------------

export interface PayoutDobInput {
  day: number;
  month: number;
  year: number;
}

export interface PayoutDetailsInput {
  firstName: string;
  lastName: string;
  dob: PayoutDobInput;
  address: PayoutAddressInput;
  /** Any format the user types; normalised to E.164 by validatePayoutDetails. */
  phone: string;
}

export interface BankAccountTokenInput {
  accountHolderName: string;
  /** 6 digits, with or without dashes/spaces. */
  sortCode: string;
  /** 8 digits (6–7 digit numbers are left-padded with zeros). */
  accountNumber: string;
}

// ---------------------------------------------------------------------------
// Requirement classification
// ---------------------------------------------------------------------------

/**
 * Which of our screens can satisfy a Stripe requirement.
 *
 * - `details`       collected by our own form and pushed via accounts.update
 * - `bank`          collected by our own form as a bank account token
 * - `verification`  only Stripe's embedded component can collect it (documents,
 *                   proof of liveness, anything we don't recognise)
 */
export type PayoutRequirementBucket = "details" | "bank" | "verification";

const DETAILS_REQUIREMENT_PATTERNS: RegExp[] = [
  /^individual\.(first_name|last_name|email|phone)$/,
  /^individual\.dob\./,
  /^individual\.address\./,
  /^business_profile\./,
  /^tos_acceptance\./,
  /^settings\./,
];

export function classifyPayoutRequirement(field: string): PayoutRequirementBucket {
  if (field === "external_account") return "bank";
  if (field.includes("verification") || field.startsWith("documents.")) return "verification";
  if (DETAILS_REQUIREMENT_PATTERNS.some((pattern) => pattern.test(field))) return "details";
  // Unknown requirement: let Stripe's component collect it rather than guess.
  return "verification";
}

export interface PayoutRequirementClassification {
  needsDetails: boolean;
  needsBankAccount: boolean;
  needsVerification: boolean;
  verificationFields: string[];
}

export function classifyPayoutRequirements(fields: string[]): PayoutRequirementClassification {
  const unique = Array.from(new Set(fields));
  const verificationFields = unique.filter((f) => classifyPayoutRequirement(f) === "verification");
  return {
    needsDetails: unique.some((f) => classifyPayoutRequirement(f) === "details"),
    needsBankAccount: unique.includes("external_account"),
    needsVerification: verificationFields.length > 0,
    verificationFields,
  };
}

// ---------------------------------------------------------------------------
// Validators / normalisers
// ---------------------------------------------------------------------------

export const PAYOUT_MINIMUM_AGE = 18;

const DIGITS_ONLY = /^\d+$/;
const E164 = /^\+[1-9]\d{6,14}$/;
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/;

/** "12-34-56", "12 34 56" or "123456" → "123456"; anything else → null. */
export function normaliseSortCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

/** "123456" → "12-34-56". Assumes a normalised 6-digit sort code. */
export function formatSortCode(sortCode: string): string {
  const digits = sortCode.replace(/\D/g, "");
  if (digits.length !== 6) return sortCode;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/**
 * UK account numbers are 8 digits. Some banks print 6 or 7; those are
 * left-padded with zeros, which is what the bank expects.
 */
export function normaliseAccountNumber(input: string): string | null {
  const digits = input.replace(/\s/g, "");
  if (!DIGITS_ONLY.test(digits)) return null;
  if (digits.length < 6 || digits.length > 8) return null;
  return digits.padStart(8, "0");
}

/**
 * Normalise a phone number to E.164, defaulting to the UK.
 *
 *   "07700 900123"     → "+447700900123"
 *   "+44 (0)7700..."   → "+447700900123"
 *   "0044 7700 900123" → "+447700900123"
 *   "+14155551234"     → "+14155551234" (any valid E.164 is accepted as-is)
 */
export function normaliseUkPhone(input: string): string | null {
  let value = input.trim().replace(/[\s\-().]/g, "");
  if (!value) return null;

  // "+44(0)7..." is a common way of writing a UK number
  value = value.replace(/^\+440/, "+44");

  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  else if (value.startsWith("0")) value = `+44${value.slice(1)}`;
  else if (value.startsWith("44") && value.length >= 12) value = `+${value}`;

  return E164.test(value) ? value : null;
}

/** "sw1a1aa" → "SW1A 1AA"; invalid → null. */
export function normaliseUkPostcode(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5 || compact.length > 7) return null;
  const spaced = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  return UK_POSTCODE.test(spaced) ? spaced : null;
}

/**
 * Returns an error message, or null when the date of birth is a real calendar
 * date for someone at least PAYOUT_MINIMUM_AGE and at most 120 years old.
 */
export function validateDob(dob: PayoutDobInput, today: Date = new Date()): string | null {
  const { day, month, year } = dob;
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return "Enter your date of birth as day, month and year";
  }
  if (year < 1900) return "Enter a valid year";

  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) return "That date doesn't exist";

  const cutoff = new Date(
    Date.UTC(today.getUTCFullYear() - PAYOUT_MINIMUM_AGE, today.getUTCMonth(), today.getUTCDate())
  );
  if (date > cutoff) return `You must be at least ${PAYOUT_MINIMUM_AGE} to sell on ButterGolf`;

  const oldest = new Date(
    Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate())
  );
  if (date < oldest) return "Enter a valid date of birth";

  return null;
}

export type PayoutDetailsField =
  | "firstName"
  | "lastName"
  | "dob"
  | "line1"
  | "city"
  | "postalCode"
  | "phone";

export interface PayoutDetailsValidation {
  ok: boolean;
  errors: Partial<Record<PayoutDetailsField, string>>;
  /** Trimmed and normalised input, present only when `ok`. */
  value?: PayoutDetailsInput;
}

export function validatePayoutDetails(
  input: PayoutDetailsInput,
  today: Date = new Date()
): PayoutDetailsValidation {
  const errors: Partial<Record<PayoutDetailsField, string>> = {};

  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  if (!firstName) errors.firstName = "Enter your first name";
  if (!lastName) errors.lastName = "Enter your last name";

  const dobError = validateDob(input.dob ?? { day: NaN, month: NaN, year: NaN }, today);
  if (dobError) errors.dob = dobError;

  const line1 = (input.address?.line1 ?? "").trim();
  const line2 = (input.address?.line2 ?? "").trim();
  const city = (input.address?.city ?? "").trim();
  if (!line1) errors.line1 = "Enter the first line of your address";
  if (!city) errors.city = "Enter your town or city";
  const postalCode = normaliseUkPostcode(input.address?.postalCode ?? "");
  if (!postalCode) errors.postalCode = "Enter a valid UK postcode";

  const phone = normaliseUkPhone(input.phone ?? "");
  if (!phone) errors.phone = "Enter a valid mobile number";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors,
    value: {
      firstName,
      lastName,
      dob: input.dob,
      address: {
        line1,
        ...(line2 ? { line2 } : {}),
        city,
        postalCode: postalCode as string,
      },
      phone: phone as string,
    },
  };
}

export type BankAccountField = "accountHolderName" | "sortCode" | "accountNumber";

export interface BankAccountValidation {
  ok: boolean;
  errors: Partial<Record<BankAccountField, string>>;
  /** Normalised input (6-digit sort code, 8-digit account number), present only when `ok`. */
  value?: BankAccountTokenInput;
}

export function validateBankAccountInput(input: BankAccountTokenInput): BankAccountValidation {
  const errors: Partial<Record<BankAccountField, string>> = {};

  const accountHolderName = (input.accountHolderName ?? "").trim();
  if (accountHolderName.length < 2) errors.accountHolderName = "Enter the name on the account";

  const sortCode = normaliseSortCode(input.sortCode ?? "");
  if (!sortCode) errors.sortCode = "Sort code must be 6 digits";

  const accountNumber = normaliseAccountNumber(input.accountNumber ?? "");
  if (!accountNumber) errors.accountNumber = "Account number must be 8 digits";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors,
    value: {
      accountHolderName,
      sortCode: sortCode as string,
      accountNumber: accountNumber as string,
    },
  };
}
