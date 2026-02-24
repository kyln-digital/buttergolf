/**
 * Safe wrapper for @stripe/stripe-react-native that gracefully handles
 * missing native modules (e.g. when running in Expo Go instead of a dev build).
 *
 * The Stripe React Native SDK eagerly loads TurboModules (OnrampSdk, etc.)
 * at import time, which crashes if native binaries aren't present.
 */
import React from "react";

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

let _StripeProvider: React.ComponentType<StripeProviderProps> | null = null;
let _stripeAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stripeMod = require("@stripe/stripe-react-native");
  _StripeProvider = stripeMod.StripeProvider;
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
