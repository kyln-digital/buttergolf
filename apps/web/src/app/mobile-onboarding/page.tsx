"use client";

/* eslint-disable react/forbid-elements -- WebView-only page rendered in RN WebView, no design system available */
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { brandColors } from "@buttergolf/config";
import type { StripeConnectInstance, StepChange } from "@stripe/connect-js";
import type { PayoutStatus } from "@buttergolf/constants";

/**
 * Mobile verification fallback
 *
 * Payout setup is native: the mobile app's PayoutSetupScreen collects the
 * seller's name, date of birth, address, phone and bank details and pushes
 * them to Stripe itself. This page exists only for what is left — an ID
 * document, proof of liveness, anything Stripe insists on collecting in its
 * own UI — so it loads the embedded onboarding component restricted to exactly
 * the requirements /api/stripe/connect/status reports as outstanding
 * (`verificationFields`). When nothing is outstanding it returns to the app
 * without showing Stripe's form at all.
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
    console.info("[MobileOnboarding] postMessage:", message);
  }
}

export default function MobileOnboardingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const apiUrl = searchParams.get("apiUrl") || "";
  /**
   * `?mode=verification` is what the current app passes: it has its own
   * native details and bank form, so this page only needs to collect the
   * identity checks Stripe insists on. Without it (binaries shipped before the
   * native form existed) this page is the seller's entire payout setup and
   * must run Stripe's full onboarding as it always did.
   */
  const verificationOnly = searchParams.get("mode") === "verification";

  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * The requirements to hand Stripe's component, from the status endpoint.
   * `null` means we could not read the status, in which case we fall back to
   * whatever Stripe says is currently due.
   */
  const [verificationFields, setVerificationFields] = useState<string[] | null>(null);
  const hasRedirectedRef = useRef(false);

  // Signal ready to React Native
  useEffect(() => {
    postMessageToRN({ type: "ready" });
  }, []);

  const returnToApp = useCallback((reason: "complete" | "exit") => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    const deepLink = `buttergolf://seller/onboarding/complete?reason=${reason}`;
    postMessageToRN({ type: "exit", success: true, reason });
    window.location.href = deepLink;
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

      // Verification mode: ask our own API what Stripe still wants from its
      // UI before loading anything. If the answer is "nothing", the seller has
      // no business seeing Stripe's form and we hand them straight back.
      // Legacy mode skips this — the seller may have no account yet and needs
      // the full flow.
      // This fails closed: without a known list of verification fields we
      // would mount Stripe's unrestricted form and start re-collecting
      // details the native flow owns, so a failed status read is an error
      // with a retry, never a fallback to the full flow.
      if (verificationOnly) {
        let fields: string[];
        try {
          const statusResponse = await fetch(`${baseUrl}/api/stripe/connect/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!statusResponse.ok) {
            throw new Error(`Status request failed (${statusResponse.status})`);
          }
          const status = (await statusResponse.json()) as Pick<PayoutStatus, "verificationFields">;
          fields = Array.isArray(status?.verificationFields) ? status.verificationFields : [];
        } catch (statusError) {
          console.error("[MobileOnboarding] Could not read payout status:", statusError);
          const errorMsg = "We couldn't check what's still needed. Please try again.";
          setError(errorMsg);
          setLoading(false);
          postMessageToRN({ type: "error", message: errorMsg });
          return;
        }

        if (fields.length === 0) {
          returnToApp("complete");
          return;
        }

        setVerificationFields(fields);
      }

      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          const response = await fetch(`${baseUrl}/api/stripe/connect/account`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to initialize onboarding");
          }

          const { clientSecret } = await response.json();
          return clientSecret;
        },
        appearance: {
          variables: {
            colorPrimary: brandColors.spicedClementine,
            colorBackground: brandColors.pureWhite,
            colorText: brandColors.ironstone,
            colorDanger: brandColors.errorBase,
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
      const errorMsg = err instanceof Error ? err.message : "Failed to initialize onboarding";
      console.error("[MobileOnboarding] Error:", err);
      setError(errorMsg);
      setLoading(false);
      postMessageToRN({ type: "error", message: errorMsg });
    }
  }, [token, apiUrl, verificationOnly, returnToApp]);

  // Initialize on mount - only runs once due to dependency array
  useEffect(() => {
    // Use void to indicate intentional fire-and-forget
    void initializeOnboarding();  
  }, [initializeOnboarding]);

  const handleStepChange = useCallback((stepChange: StepChange) => {
    postMessageToRN({ type: "step_change", step: stepChange.step });
  }, []);

  const handleExit = useCallback(() => {
    // Embedded onboarding exited (close button / done)
    returnToApp("exit");
  }, [returnToApp]);

  // Auto-return to the app once there is nothing left to collect here, so the
  // seller doesn't have to hunt for a close button. In verification mode that
  // means Stripe has no verification fields left (anything else is the native
  // form's job); in legacy mode it means nothing at all is left to collect.
  useEffect(() => {
    if (!token || loading) return;

    const baseUrl = apiUrl || "";
    const interval = window.setInterval(async () => {
      if (hasRedirectedRef.current) return;

      try {
        const response = await fetch(`${baseUrl}/api/stripe/connect/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const status = (await response.json()) as Pick<
          PayoutStatus,
          "verificationFields" | "needsDetails" | "needsBankAccount" | "needsVerification"
        >;
        const nothingLeftHere = verificationOnly
          ? Array.isArray(status?.verificationFields) && status.verificationFields.length === 0
          : !status?.needsDetails && !status?.needsBankAccount && !status?.needsVerification;
        if (nothingLeftHere) {
          returnToApp("complete");
        }
      } catch {
        // Ignore polling failures; user can still exit manually.
      }
    }, 1500);

    return () => {
      window.clearInterval(interval);
    };
  }, [token, loading, apiUrl, verificationOnly, returnToApp]);

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Checking what Stripe still needs...</p>
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
            fields: "currently_due",
            futureRequirements: "omit",
            ...(verificationOnly && verificationFields
              ? // Verification fallback: only the requirements our own form
                // cannot satisfy. Name, date of birth, address, phone and bank
                // details were already pushed natively by PayoutSetupScreen.
                { requirements: { only: verificationFields } }
              : // Legacy full onboarding: keep the seller type fixed and hide
                // the business-profile fields we prefill.
                {
                  requirements: {
                    exclude: [
                      "business_type",
                      "business_profile.url",
                      "business_profile.product_description",
                    ],
                  },
                }),
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
    backgroundColor: brandColors.pureWhite,
    display: "flex",
    flexDirection: "column",
    paddingLeft: 16,
    paddingRight: 16,
  },
  loadingContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: "100vh",
    backgroundColor: brandColors.pureWhite,
  },
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${brandColors.cloudMist}`,
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
    backgroundColor: brandColors.pureWhite,
  },
  errorTitle: {
    color: brandColors.errorBase,
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
