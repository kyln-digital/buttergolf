import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Seller status as returned by the /api/users/seller-status endpoint
 */
export interface SellerStatus {
  /** Whether user has a Stripe Connect account */
  hasAccount: boolean;
  /** Whether Stripe onboarding is complete */
  onboardingComplete: boolean;
  /** Whether user can create listings (onboarding complete + charges enabled) */
  isReadyToSell: boolean;
  /** Account status: pending, active, or restricted */
  accountStatus: "pending" | "active" | "restricted" | null;
  /** Whether the account can accept payments */
  chargesEnabled: boolean;
  /** Whether the account can receive payouts */
  payoutsEnabled: boolean;
  /** Outstanding requirements from Stripe */
  requirements?: string[];
}

export interface UseSellerStatusOptions {
  /** Base API URL (e.g., process.env.EXPO_PUBLIC_API_URL) */
  apiUrl: string;
  /** Function to get auth token (from Clerk's useAuth) */
  getToken: () => Promise<string | null>;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

export interface UseSellerStatusResult {
  /** Current seller status */
  status: SellerStatus | null;
  /** Whether the status is being loaded */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the seller status. Pass true to force refresh (bypass throttle). */
  refresh: (force?: boolean) => Promise<void>;
}

const DEFAULT_STATUS: SellerStatus = {
  hasAccount: false,
  onboardingComplete: false,
  isReadyToSell: false,
  accountStatus: null,
  chargesEnabled: false,
  payoutsEnabled: false,
};

// Module-level throttle state - persists across component remounts
// This is critical because the Sell screen remounts on navigation state changes
let lastFetchTime = 0;
let isFetching = false;
const FETCH_COOLDOWN_MS = 5000; // 5 second cooldown between fetches

/**
 * @deprecated DO NOT USE THIS HOOK - It causes infinite API call loops!
 *
 * This hook was deprecated because each component mount creates a new hook instance
 * that fetches independently. Navigation between screens causes remounts, triggering
 * repeated fetches that overwhelm the API.
 *
 * INSTEAD: Use the SellerStatusProvider context in apps/mobile/context/SellerStatusContext.tsx
 * which fetches once at app level and shares state via context.
 *
 * For mobile: import { useSellerStatusContext } from "../context";
 * For web: Use server-side fetching in page.tsx (see apps/web/src/app/sell/page.tsx)
 *
 * This hook is kept only for the SellerStatus type export and backward compatibility.
 * If you're reading this and need seller status, use the context-based approach.
 */
export function useSellerStatus({
  apiUrl,
  getToken,
  isAuthenticated,
}: UseSellerStatusOptions): UseSellerStatusResult {
  // Log deprecation warning in development
  if (typeof globalThis !== "undefined" && (globalThis as { __DEV__?: boolean }).__DEV__) {
    console.warn(
      "[useSellerStatus] DEPRECATED: This hook causes infinite API calls. " +
      "Use useSellerStatusContext from apps/mobile/context instead."
    );
  }

  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs for functions to avoid them triggering useEffect reruns
  const getTokenRef = useRef(getToken);
  const apiUrlRef = useRef(apiUrl);

  // Keep refs updated
  useEffect(() => {
    getTokenRef.current = getToken;
    apiUrlRef.current = apiUrl;
  });

  const fetchStatus = useCallback(async (force?: boolean) => {
    const isDev =
      typeof globalThis !== "undefined" &&
      (globalThis as { __DEV__?: boolean }).__DEV__ === true;

    const debugLog = (...args: unknown[]) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log("[useSellerStatus]", ...args);
      }
    };

    debugLog("fetchStatus called, isAuthenticated:", isAuthenticated, "force:", force);
    
    // Handle unauthenticated case before setting the fetching guard
    if (!isAuthenticated) {
      debugLog("Not authenticated, returning default status");
      setStatus(DEFAULT_STATUS);
      setIsLoading(false);
      return;
    }

    // Throttle: skip if we fetched recently (prevents rapid polling)
    // Uses module-level variable to persist across component remounts
    // Can be bypassed with force=true (e.g., after completing onboarding)
    const now = Date.now();
    if (!force && now - lastFetchTime < FETCH_COOLDOWN_MS) {
      debugLog("Skipping fetch - within cooldown period");
      return;
    }

    // Prevent concurrent fetches - uses module-level variable
    if (isFetching) {
      debugLog("fetchStatus skipped - already fetching");
      return;
    }
    isFetching = true;
    lastFetchTime = now; // Set time at start to prevent races

    try {
      setIsLoading(true);
      setError(null);

      const token = await getTokenRef.current();
      debugLog("Token obtained:", token ? "yes" : "no");
      
      if (!token) {
        debugLog("No token, returning default status");
        setStatus(DEFAULT_STATUS);
        // Reset guards before early return since we won't reach finally block
        setIsLoading(false);
        isFetching = false;
        return;
      }

      const url = `${apiUrlRef.current}/api/users/seller-status`;
      debugLog("Fetching from:", url);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

  debugLog("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch seller status: ${response.status}`);
      }

      const data = await response.json();
      debugLog("Response data:", data);
      setStatus(data);
    } catch (err) {
      console.error("[useSellerStatus] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(DEFAULT_STATUS);
    } finally {
      setIsLoading(false);
      isFetching = false;
    }
  }, [isAuthenticated]); // Only depend on isAuthenticated, use refs for apiUrl and getToken

  // Fetch status on mount and when auth changes
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}
