"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";

interface UseStripeConnectReturn {
  stripeConnectInstance: StripeConnectInstance | null;
  loading: boolean;
  error: string | null;
  hasAccount: boolean;
  accountId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to initialize Stripe Connect for the seller dashboard
 *
 * This hook:
 * 1. Checks if the user has a Connect account
 * 2. Fetches a fresh AccountSession from the API
 * 3. Initializes the Connect.js instance with branded appearance
 *
 * The instance can be used with ConnectComponentsProvider to render
 * all embedded components (onboarding, payments, payouts, etc.)
 */
export function useStripeConnect(): UseStripeConnectReturn {
  const { user, isLoaded } = useUser();
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (!isLoaded) return;

    if (!user) {
      setLoading(false);
      setError("You must be signed in to access seller features");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. First check if user has a Connect account
      const statusResponse = await fetch("/api/stripe/connect/account", {
        method: "GET",
      });

      if (!statusResponse.ok) {
        const data = await statusResponse.json();
        throw new Error(data.error || "Failed to check account status");
      }

      const statusData = await statusResponse.json();

      if (!statusData.hasAccount) {
        // User doesn't have a Connect account yet
        setHasAccount(false);
        setAccountId(null);
        setLoading(false);
        return;
      }

      setHasAccount(true);
      setAccountId(statusData.accountId);

      // 2. Fetch AccountSession for embedded components
      const sessionResponse = await fetch("/api/stripe/connect/account-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!sessionResponse.ok) {
        const data = await sessionResponse.json();
        throw new Error(data.error || "Failed to create account session");
      }

      const { clientSecret } = await sessionResponse.json();

      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error("Stripe publishable key not configured");
      }

      // 3. Initialize Stripe Connect.js with branded appearance
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => clientSecret,
        appearance: {
          variables: {
            // ButterGolf brand colors
            colorPrimary: "#F45314", // $spicedClementine
            colorBackground: "#FFFFFF", // Pure White
            colorText: "#323232", // $ironstone
            colorDanger: "#dc2626", // Error red
            fontFamily: "system-ui, -apple-system, sans-serif",
            spacingUnit: "4px",
            borderRadius: "10px",
          },
        },
      });

      setStripeConnectInstance(instance);
    } catch (err) {
      console.error("Error initializing Stripe Connect:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize Stripe Connect");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, user]);

  // Initialize on mount and when user changes
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Expose refresh function for manual re-initialization
  const refresh = useCallback(async () => {
    setStripeConnectInstance(null);
    await initialize();
  }, [initialize]);

  return {
    stripeConnectInstance,
    loading,
    error,
    hasAccount,
    accountId,
    refresh,
  };
}
