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
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";

  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable function identity and throttling
  const getTokenRef = useRef(getToken);
  const lastFetchTime = useRef(0);
  const isFetching = useRef(false);

  // Keep getToken ref updated
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const fetchStatus = useCallback(async (force?: boolean) => {
    const isDev =
      typeof globalThis !== "undefined" &&
      (globalThis as { __DEV__?: boolean }).__DEV__ === true;

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

    isFetching.current = true;
    lastFetchTime.current = now;

    try {
      setIsLoading(true);
      setError(null);

      const token = await getTokenRef.current();
      debugLog("Token obtained:", token ? "yes" : "no");

      if (!token) {
        debugLog("No token, returning default status");
        setStatus(DEFAULT_STATUS);
        setIsLoading(false);
        isFetching.current = false;
        return;
      }

      const url = `${apiUrl}/api/users/seller-status`;
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
      console.error("[SellerStatusProvider] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(DEFAULT_STATUS);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [apiUrl]);

  // Fetch status once on mount
  // This runs ONCE because fetchStatus is stable (only depends on apiUrl which doesn't change)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <SellerStatusContext.Provider
      value={{ status, isLoading, error, refresh: fetchStatus }}
    >
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
