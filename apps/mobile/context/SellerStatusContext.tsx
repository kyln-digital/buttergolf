import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-expo";
import { deferredFetch } from "../lib/apiClient";

// Re-export SellerStatus from the original hook to maintain single source of truth
export type { SellerStatus } from "@buttergolf/app/src/hooks/useSellerStatus";
import type { SellerStatus } from "@buttergolf/app/src/hooks/useSellerStatus";

interface SellerStatusContextValue {
  /** Current seller status (null if not yet fetched) */
  status: SellerStatus | null;
  /** Whether the status is being loaded */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the seller status. Pass true to force refresh (bypass throttle). */
  refresh: (force?: boolean) => Promise<void>;
}

const SellerStatusContext = createContext<SellerStatusContextValue | null>(null);

const DEFAULT_STATUS: SellerStatus = {
  hasAccount: false,
  onboardingComplete: false,
  isReadyToSell: false,
  accountStatus: null,
  chargesEnabled: false,
  payoutsEnabled: false,
};

const FETCH_COOLDOWN_MS = 5000; // 5 second cooldown between fetches

interface SellerStatusProviderProps {
  children: ReactNode;
}

/**
 * SellerStatusProvider - Provides seller status to the entire app
 *
 * IMPORTANT: This provider should be placed inside <SignedIn> and <ClerkLoaded>
 * to guarantee that authentication is available when it mounts.
 *
 * WHY THIS EXISTS:
 * We had a recurring bug where the useSellerStatus hook caused infinite API calls
 * because each component mount created a new hook instance that fetched independently.
 * Navigation between screens caused remounts, triggering new fetches.
 *
 * This context-based solution:
 * 1. Fetches seller status ONCE when the provider mounts
 * 2. Shares that state to all consumers via context
 * 3. Survives navigation (provider stays mounted at app level)
 * 4. Provides a refresh() function for explicit re-fetches (e.g., after onboarding)
 *
 * DO NOT go back to a hook-based approach - it will break again.
 */
export function SellerStatusProvider({ children }: SellerStatusProviderProps) {
  const { getToken } = useAuth();

  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable function identity and throttling
  // Using refs for apiUrl and getToken keeps fetchStatus stable (no deps that change)
  const apiUrlRef = useRef(process.env.EXPO_PUBLIC_API_URL || "");
  const getTokenRef = useRef(getToken);
  const lastFetchTime = useRef(0);
  const isFetching = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep getToken ref updated (synchronous assignment is fine here)
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const fetchStatus = useCallback(async (force?: boolean) => {
    // Standard React Native __DEV__ check
    const isDev = typeof __DEV__ !== "undefined" && __DEV__;

    const debugLog = (...args: unknown[]) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log("[SellerStatusProvider]", ...args);
      }
    };

    // Throttle: skip if we fetched recently (prevents rapid polling)
    const now = Date.now();
    if (!force && now - lastFetchTime.current < FETCH_COOLDOWN_MS) {
      debugLog("Skipping fetch - within cooldown period");
      return;
    }

    // Prevent concurrent fetches
    if (isFetching.current) {
      debugLog("Skipping fetch - already fetching");
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    isFetching.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const url = `${apiUrlRef.current}/api/users/seller-status`;
      debugLog("Fetching from:", url);

      // Use deferredFetch to prevent TurboModule race conditions during navigation
      // This defers the getToken call (which accesses SecureStore) until after animations complete
      const response = await deferredFetch(url, {
        getToken: getTokenRef.current,
        signal,
      });

      // Check if aborted before processing response
      if (signal.aborted) return;

      debugLog("Response status:", response.status);

      // Handle 401 (not authenticated) - return default status
      if (response.status === 401) {
        debugLog("Not authenticated, returning default status");
        setStatus(DEFAULT_STATUS);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch seller status: ${response.status}`);
      }

      const data = await response.json();

      // Check if aborted before updating state
      if (signal.aborted) return;

      debugLog("Response data:", data);
      setStatus(data);
      // Update lastFetchTime only on success (not at start)
      // This ensures throttle doesn't block retries after failures
      lastFetchTime.current = Date.now();
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        debugLog("Fetch aborted");
        return;
      }
      console.error("[SellerStatusProvider] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // Preserve previous status on transient errors (network issues)
      // Only set DEFAULT_STATUS if we never had data
      setStatus((prev) => prev ?? DEFAULT_STATUS);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []); // No dependencies - uses refs for all external values

  // Fetch status once on mount, cleanup on unmount
  useEffect(() => {
    fetchStatus();

    // Cleanup: abort any in-flight request when provider unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStatus]);

  return (
    <SellerStatusContext.Provider value={{ status, isLoading, error, refresh: fetchStatus }}>
      {children}
    </SellerStatusContext.Provider>
  );
}

/**
 * Hook to access seller status from context
 *
 * MUST be used within a SellerStatusProvider (which should be inside SignedIn)
 *
 * @throws Error if used outside of SellerStatusProvider
 */
export function useSellerStatusContext(): SellerStatusContextValue {
  const context = useContext(SellerStatusContext);
  if (!context) {
    throw new Error(
      "useSellerStatusContext must be used within SellerStatusProvider. " +
        "Make sure the provider is placed inside <SignedIn> in App.tsx."
    );
  }
  return context;
}
