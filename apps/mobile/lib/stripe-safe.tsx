/**
 * Safe wrapper for @stripe/stripe-react-native that gracefully handles
 * missing native modules (e.g. when running in Expo Go instead of a dev build).
 *
 * The Stripe React Native SDK eagerly loads TurboModules (OnrampSdk, etc.)
 * at import time, which crashes if native binaries aren't present.
 */
import React from "react";

type StripeProviderProps = {
  publishableKey: string;
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
export function SafeStripeProvider({ publishableKey, children }: StripeProviderProps) {
  if (_StripeProvider) {
    const Provider = _StripeProvider;
    return <Provider publishableKey={publishableKey}>{children}</Provider>;
  }
  return <>{children}</>;
}
