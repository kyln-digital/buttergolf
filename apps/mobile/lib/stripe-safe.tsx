/**
 * Safe wrapper for @stripe/stripe-react-native that gracefully handles
 * missing native modules (e.g. when running in Expo Go instead of a dev build).
 *
 * The Stripe React Native SDK eagerly loads TurboModules (OnrampSdk, etc.)
 * at import time, which crashes if native binaries aren't present.
 */
import React from "react";
import type { BankAccountTokenInput } from "@buttergolf/constants";

/**
 * Default Apple Pay merchant identifier for ButterGolf.
 *
 * This is required for iOS Apple Pay integration with `@stripe/stripe-react-native`.
 * The value must match a Merchant ID configured in Apple Developer and linked to Stripe.
 *
 * Override per environment with `EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER`.
 * Typical format: `merchant.{domain}.{app}`.
 *
 * Apple docs:
 * https://developer.apple.com/documentation/passkit/apple_pay/setting_up_apple_pay
 */
export const DEFAULT_STRIPE_MERCHANT_IDENTIFIER = "merchant.com.buttergolf.app";

type StripeProviderProps = {
  publishableKey: string;
  merchantIdentifier?: string;
  children: React.ReactNode;
};

/**
 * The slice of stripe-react-native's `createToken` we use, typed locally so
 * this file never has to import from the SDK at type level (the require below
 * is deliberately dynamic so Expo Go doesn't blow up at import time).
 *
 * Mirrors `Token.CreateBankAccountTokenParams` in @stripe/stripe-react-native.
 */
type CreateBankAccountTokenParams = {
  type: "BankAccount";
  accountHolderName?: string;
  accountHolderType?: "Company" | "Individual";
  accountNumber: string;
  country: string;
  currency: string;
  routingNumber?: string;
};

type CreateTokenFn = (params: CreateBankAccountTokenParams) => Promise<{
  token?: { id: string };
  error?: { message: string };
}>;

let _StripeProvider: React.ComponentType<StripeProviderProps> | null = null;
let _createToken: CreateTokenFn | null = null;
let _stripeAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stripeMod = require("@stripe/stripe-react-native");
  _StripeProvider = stripeMod.StripeProvider;
  _createToken = stripeMod.createToken;
  _stripeAvailable = true;
} catch {
  // Native module not available (Expo Go) — provide a passthrough
  _stripeAvailable = false;
}

export const isStripeAvailable = _stripeAvailable;

/**
 * Renders `<StripeProvider>` when native modules are available,
 * otherwise renders children directly (passthrough).
 */
export function SafeStripeProvider({
  publishableKey,
  merchantIdentifier,
  children,
}: StripeProviderProps) {
  if (_StripeProvider) {
    const Provider = _StripeProvider;
    return (
      <Provider publishableKey={publishableKey} merchantIdentifier={merchantIdentifier}>
        {children}
      </Provider>
    );
  }
  return <>{children}</>;
}

/**
 * Tokenise UK bank details on the device so the account number never reaches
 * ButterGolf's servers — the seller's payout form sends Stripe the resulting
 * `btok_…` id instead.
 *
 * Throws a plain Error; the caller (usePayoutSetupActions) wraps it in a
 * PayoutSetupError so the shared screen can show it.
 */
export async function createBankAccountToken(input: BankAccountTokenInput): Promise<string> {
  if (!_createToken) {
    throw new Error("Bank details can't be added in Expo Go. Use a development build.");
  }

  const { token, error } = await _createToken({
    type: "BankAccount",
    country: "GB",
    currency: "gbp",
    accountNumber: input.accountNumber,
    routingNumber: input.sortCode,
    accountHolderName: input.accountHolderName,
    accountHolderType: "Individual",
  });

  if (error) {
    throw new Error(error.message || "We couldn't check those bank details. Please try again.");
  }
  if (!token?.id) {
    throw new Error("Stripe didn't return a bank account token. Please try again.");
  }

  return token.id;
}
