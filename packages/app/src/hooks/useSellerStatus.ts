import { useState, useEffect, useCallback } from "react";

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

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setStatus(DEFAULT_STATUS);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        setStatus(DEFAULT_STATUS);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/api/users/seller-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch seller status: ${response.status}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error("[useSellerStatus] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(DEFAULT_STATUS);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, getToken, isAuthenticated]);

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
