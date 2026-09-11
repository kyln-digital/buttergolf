"use client";

import { useCallback, useEffect, useState } from "react";
import type { PayoutStatus } from "@buttergolf/constants";

interface UsePayoutStatusReturn {
  status: PayoutStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Reads the seller's payout state from `GET /api/stripe/connect/status`.
 *
 * The route answers with the {@link PayoutStatus} DTO, which already tells us
 * what the seller still has to do (details, bank account, verification), so
 * callers never have to reason about Stripe's raw requirement names.
 */
export function usePayoutStatus(): UsePayoutStatusReturn {
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
