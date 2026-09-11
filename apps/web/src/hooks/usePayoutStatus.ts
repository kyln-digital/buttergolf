"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PayoutStatus } from "@buttergolf/constants";

export interface UsePayoutStatusReturn {
  status: PayoutStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * One fetch of `GET /api/stripe/connect/status`.
 *
 * The route answers with the {@link PayoutStatus} DTO, which already tells us
 * what the seller still has to do (details, bank account, verification), so
 * callers never have to reason about Stripe's raw requirement names.
 *
 * `enabled=false` keeps the hook inert (used when a provider already holds the
 * shared value, since hooks must run unconditionally).
 */
function usePayoutStatusFetch(enabled: boolean): UsePayoutStatusReturn {
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/connect/status", { credentials: "include" });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Sign in to see your payout details"
            : "We couldn't load your payout details"
        );
      }

      setStatus((await response.json()) as PayoutStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load your payout details");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}

const PayoutStatusContext = createContext<UsePayoutStatusReturn | null>(null);

/**
 * Fetches the payout status once and shares it with every descendant that
 * calls {@link usePayoutStatus}. The seller layout mounts this so the banner
 * and the page underneath read one Stripe account read rather than each
 * making their own.
 */
export function PayoutStatusProvider({ children }: { readonly children: ReactNode }) {
  const value = usePayoutStatusFetch(true);
  return createElement(PayoutStatusContext.Provider, { value }, children);
}

/**
 * The seller's payout status. Inside a {@link PayoutStatusProvider} this is
 * the shared value (one fetch per navigation); outside one it fetches on its
 * own, so the hook stays usable on pages the seller layout doesn't wrap.
 */
export function usePayoutStatus(): UsePayoutStatusReturn {
  const shared = useContext(PayoutStatusContext);
  const own = usePayoutStatusFetch(shared === null);
  return shared ?? own;
}
