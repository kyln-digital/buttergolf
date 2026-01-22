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
  /** Refresh the seller status */
  refresh: () => Promise<void>;
}

const DEFAULT_STATUS: SellerStatus = {
  hasAccount: false,
  onboardingComplete: false,
  isReadyToSell: false,
  accountStatus: null,
  chargesEnabled: false,
  payoutsEnabled: false,
};

/**
 * Hook to fetch and manage the current user's seller/Stripe Connect status.
 *
 * Usage:
 * ```tsx
 * const { status, isLoading, refresh } = useSellerStatus({
 *   apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
 *   getToken,
 *   isAuthenticated: true,
 * });
 *
 * if (status?.isReadyToSell) {
 *   // Show sell form
 * } else {
 *   // Show onboarding prompt
 * }
 * ```
 */
export function useSellerStatus({
  apiUrl,
  getToken,
  isAuthenticated,
}: UseSellerStatusOptions): UseSellerStatusResult {
  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs for functions to avoid them triggering useEffect reruns
  const getTokenRef = useRef(getToken);
  const apiUrlRef = useRef(apiUrl);
  // Guard to prevent concurrent fetches (fixes loop when multiple triggers fire)
  const fetchingRef = useRef(false);
  // Throttle: track last successful fetch time to prevent rapid calls
  const lastFetchTimeRef = useRef<number>(0);
  const FETCH_COOLDOWN_MS = 5000; // 5 second cooldown between fetches

  // Keep refs updated
  useEffect(() => {
    getTokenRef.current = getToken;
    apiUrlRef.current = apiUrl;
  });

  const fetchStatus = useCallback(async () => {
    const isDev =
      typeof globalThis !== "undefined" &&
      (globalThis as { __DEV__?: boolean }).__DEV__ === true;

    const debugLog = (...args: unknown[]) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log("[useSellerStatus]", ...args);
      }
    };

    debugLog("fetchStatus called, isAuthenticated:", isAuthenticated);
    
    // Handle unauthenticated case before setting the fetching guard
    if (!isAuthenticated) {
      debugLog("Not authenticated, returning default status");
      setStatus(DEFAULT_STATUS);
      setIsLoading(false);
      return;
    }

    // Throttle: skip if we fetched recently (prevents rapid polling)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_COOLDOWN_MS) {
      debugLog("Skipping fetch - within cooldown period");
      return;
    }

    // Prevent concurrent fetches - this is the key fix for the loop
    if (fetchingRef.current) {
      debugLog("fetchStatus skipped - already fetching");
      return;
    }
    fetchingRef.current = true;
    lastFetchTimeRef.current = now; // Set time at start to prevent races

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
        fetchingRef.current = false;
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
      fetchingRef.current = false;
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
