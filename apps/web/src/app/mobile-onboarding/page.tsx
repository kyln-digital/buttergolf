"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import { brandColors } from "@buttergolf/config";
import type { StripeConnectInstance, StepChange } from "@stripe/connect-js";

/**
 * Mobile Onboarding Page
 *
 * This page is loaded inside a WebView in the mobile app to provide
 * the Stripe Connect embedded onboarding experience.
 *
 * Communication with React Native:
 * - Receives short-lived mobile session token via URL query param: ?token=xxx
 *   (NOT a Clerk token - the mobile app exchanges Clerk token for this short-lived token
 *    via /api/stripe/connect/mobile-session for security)
 * - Sends messages back via window.ReactNativeWebView.postMessage()
 *
 * Messages sent to React Native:
 * - { type: "ready" } - Page is loaded and ready
 * - { type: "initialized" } - Stripe Connect instance created
 * - { type: "step_change", step: string } - User progressed through onboarding
 * - { type: "exit", success: boolean } - User exited onboarding
 * - { type: "error", message: string } - An error occurred
 */

// Extend Window interface for React Native WebView bridge
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

function postMessageToRN(message: Record<string, unknown>) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  } else {
    // Dev fallback - log to console
    console.log("[MobileOnboarding] postMessage:", message);
  }
}

export default function MobileOnboardingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const apiUrl = searchParams.get("apiUrl") || "";

  const [stripeConnectInstance, setStripeConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signal ready to React Native
  useEffect(() => {
    postMessageToRN({ type: "ready" });
  }, []);

  const initializeOnboarding = useCallback(async () => {
    if (!token) {
      const errorMsg = "No authentication token provided";
      setError(errorMsg);
      setLoading(false);
      postMessageToRN({ type: "error", message: errorMsg });
      return;
    }

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      const errorMsg = "Stripe publishable key not configured";
      setError(errorMsg);
      setLoading(false);
      postMessageToRN({ type: "error", message: errorMsg });
      return;
    }

    try {
      // Determine the API base URL
      // If apiUrl is provided, use it; otherwise use relative path (same origin)
      const baseUrl = apiUrl || "";

      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          const response = await fetch(
            `${baseUrl}/api/stripe/connect/account`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "Failed to initialize onboarding"
            );
          }

          const { clientSecret } = await response.json();
          return clientSecret;
        },
        appearance: {
          variables: {
            colorPrimary: brandColors.spicedClementine,
            colorBackground: brandColors.pureWhite,
            colorText: brandColors.ironstone,
            colorDanger: brandColors.error,
            fontFamily: "system-ui, -apple-system, sans-serif",
            spacingUnit: "12px",
            borderRadius: "10px",
          },
        },
      });

      setStripeConnectInstance(instance);
      setLoading(false);
      postMessageToRN({ type: "initialized" });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to initialize onboarding";
      console.error("[MobileOnboarding] Error:", err);
      setError(errorMsg);
      setLoading(false);
      postMessageToRN({ type: "error", message: errorMsg });
    }
  }, [token, apiUrl]);

  // Initialize on mount - only runs once due to dependency array
  useEffect(() => {
    // Use void to indicate intentional fire-and-forget
    void initializeOnboarding();
  }, [initializeOnboarding]);

  const handleStepChange = useCallback((stepChange: StepChange) => {
    postMessageToRN({ type: "step_change", step: stepChange.step });
  }, []);

  const handleExit = useCallback(() => {
    // Onboarding exited - could be complete or cancelled
    postMessageToRN({ type: "exit", success: true });
  }, []);

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Setting up your seller account...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>Something went wrong</h2>
          <p style={styles.errorText}>{error}</p>
          <button
            style={styles.retryButton}
            onClick={() => {
              setError(null);
              setLoading(true);
              initializeOnboarding();
            }}
          >
            Try Again
          </button>
          <button
            style={styles.cancelButton}
            onClick={() => postMessageToRN({ type: "exit", success: false })}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Waiting for Stripe instance
  if (!stripeConnectInstance) {
    return (
      <div style={styles.container}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  // Stripe Connect Onboarding
  return (
    <div style={styles.container}>
      <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
        <ConnectAccountOnboarding
          onExit={handleExit}
          onStepChange={handleStepChange}
          collectionOptions={{
            fields: "eventually_due",
            futureRequirements: "include",
          }}
        />
      </ConnectComponentsProvider>
    </div>
  );
}

// Inline styles to avoid any CSS conflicts in WebView
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: brandColors.vanillaCream,
    display: "flex",
    flexDirection: "column",
  },
  loadingContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: "100vh",
  },
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${brandColors.vanillaCream}`,
    borderTopColor: brandColors.spicedClementine,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: 16,
    color: brandColors.ironstone,
    fontSize: 16,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  errorContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: "100vh",
  },
  errorTitle: {
    color: brandColors.error,
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 12,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  errorText: {
    color: brandColors.ironstone,
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  retryButton: {
    backgroundColor: brandColors.spicedClementine,
    color: brandColors.pureWhite,
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 12,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  cancelButton: {
    backgroundColor: "transparent",
    color: brandColors.ironstone,
    border: `1px solid ${brandColors.ironstone}`,
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 16,
    cursor: "pointer",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
};
