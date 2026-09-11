/**
 * Errors raised by the platform adapters behind PayoutSetupScreen.
 *
 * The screen itself never talks to the network: web and mobile pass in the
 * fetchers and the tokeniser. When one of those fails it throws a
 * PayoutSetupError so the screen can tell a per-field problem (map it onto the
 * form) from a general one (show it in an error card).
 */

export interface PayoutSetupErrorOptions {
  /** Field name → message, keyed by the form field the API blamed. */
  fieldErrors?: Record<string, string>;
  /** Stripe's `param`, when the API passed one through. */
  param?: string | null;
}

export class PayoutSetupError extends Error {
  fieldErrors?: Record<string, string>;
  param?: string | null;

  constructor(message: string, opts?: PayoutSetupErrorOptions) {
    super(message);
    this.name = "PayoutSetupError";
    this.fieldErrors = opts?.fieldErrors;
    this.param = opts?.param ?? null;

    // Keep `instanceof` working when the class is down-levelled to ES5.
    Object.setPrototypeOf(this, PayoutSetupError.prototype);
  }
}

/**
 * `instanceof` across a bundler boundary is not always reliable, so fall back
 * to the shape of the error.
 */
export function isPayoutSetupError(error: unknown): error is PayoutSetupError {
  if (error instanceof PayoutSetupError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "PayoutSetupError"
  );
}

/** A message safe to show a seller, whatever was thrown. */
export function payoutErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
