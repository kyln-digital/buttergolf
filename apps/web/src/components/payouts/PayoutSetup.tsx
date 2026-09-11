"use client";

import { useCallback, type JSX } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { PayoutSetupError, PayoutSetupScreen } from "@buttergolf/app";
import type {
  BankAccountTokenInput,
  PayoutDetailsInput,
  PayoutStatus,
} from "@buttergolf/constants";
import { VerificationFallback } from "./VerificationFallback";

/** One Stripe.js load for the whole app. */
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      return Promise.reject(
        new PayoutSetupError("Payments aren't configured. Please try again later.")
      );
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

interface ApiErrorBody {
  error?: string;
  errors?: Record<string, string>;
  param?: string | null;
}

async function throwFromResponse(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  throw new PayoutSetupError(body.error || fallback, {
    fieldErrors: body.errors,
    param: body.param ?? null,
  });
}

export interface PayoutSetupProps {
  readonly initialStatus?: PayoutStatus;
  readonly initialStep?: "details" | "bank";
  readonly onComplete?: (status: PayoutStatus) => void;
  readonly onExit?: () => void;
}

/**
 * Web host for the shared payout setup screen: our own two-step "Get paid"
 * flow, with bank details tokenised in the browser so raw account numbers never
 * reach our server.
 */
export function PayoutSetup({
  initialStatus,
  initialStep,
  onComplete,
  onExit,
}: PayoutSetupProps): JSX.Element {
  const router = useRouter();

  const fetchStatus = useCallback(async (): Promise<PayoutStatus> => {
    const response = await fetch("/api/stripe/connect/status", { credentials: "include" });
    if (!response.ok) {
      await throwFromResponse(response, "We couldn't load your payout details.");
    }
    return (await response.json()) as PayoutStatus;
  }, []);

  const submitDetails = useCallback(async (input: PayoutDetailsInput): Promise<PayoutStatus> => {
    const response = await fetch("/api/stripe/connect/setup/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      await throwFromResponse(response, "We couldn't save your details.");
    }
    return (await response.json()) as PayoutStatus;
  }, []);

  const createBankAccountToken = useCallback(
    async (input: BankAccountTokenInput): Promise<string> => {
      const stripe = await getStripe();
      if (!stripe) {
        throw new PayoutSetupError("We couldn't reach our payments provider. Please try again.");
      }

      const result = await stripe.createToken("bank_account", {
        country: "GB",
        currency: "gbp",
        routing_number: input.sortCode,
        account_number: input.accountNumber,
        account_holder_name: input.accountHolderName,
        account_holder_type: "individual",
      });

      if (result.error || !result.token) {
        throw new PayoutSetupError(
          result.error?.message || "We couldn't verify those bank details.",
          { param: result.error?.param ?? null }
        );
      }

      return result.token.id;
    },
    []
  );

  const submitBankAccount = useCallback(async (token: string): Promise<PayoutStatus> => {
    const response = await fetch("/api/stripe/connect/setup/bank-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      await throwFromResponse(response, "We couldn't save your bank account.");
    }
    return (await response.json()) as PayoutStatus;
  }, []);

  const handleOpenLink = useCallback(
    (href: string) => {
      if (/^https?:\/\//i.test(href)) {
        globalThis.open(href, "_blank", "noopener");
        return;
      }
      router.push(href);
    },
    [router]
  );

  return (
    <PayoutSetupScreen
      initialStatus={initialStatus}
      initialStep={initialStep}
      fetchStatus={fetchStatus}
      submitDetails={submitDetails}
      createBankAccountToken={createBankAccountToken}
      submitBankAccount={submitBankAccount}
      renderVerification={({ status, onDone }) => (
        <VerificationFallback status={status} onDone={onDone} />
      )}
      onOpenLink={handleOpenLink}
      onComplete={onComplete}
      onExit={onExit}
    />
  );
}
