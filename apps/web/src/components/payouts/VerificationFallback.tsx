"use client";

import { useEffect, useMemo, useState } from "react";
import { Column, Card, Spinner, Text } from "@buttergolf/ui";
import { brandColors } from "@buttergolf/config";
import { ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import type { PayoutStatus } from "@buttergolf/constants";

export interface VerificationFallbackProps {
  /** Status that told us verification is outstanding. */
  readonly status: PayoutStatus;
  /** Called when the seller finishes or leaves the embedded flow. */
  readonly onDone: () => void;
}

/**
 * The only part of payout setup a seller still sees from Stripe: the identity
 * checks we cannot collect ourselves (ID document, proof of liveness).
 *
 * `collectionOptions.requirements.only` pins the component to exactly those
 * fields, so it never asks again for anything our own form already collected.
 */
export function VerificationFallback({ status, onDone }: VerificationFallbackProps) {
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verificationFields = useMemo(() => status.verificationFields, [status.verificationFields]);
  const hasFields = verificationFields.length > 0;

  // Nothing for Stripe to collect — hand straight back to the screen.
  useEffect(() => {
    if (!hasFields) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFields]);

  useEffect(() => {
    if (!hasFields || connectInstance) return;

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setError("Payments aren't configured. Please try again later.");
      return;
    }

    try {
      setConnectInstance(
        loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => {
            const response = await fetch("/api/stripe/connect/account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({}),
            });

            if (!response.ok) {
              const body = await response.json().catch(() => ({}));
              throw new Error(body.error || "We couldn't start identity verification.");
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
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start identity verification.");
    }
  }, [connectInstance, hasFields]);

  if (!hasFields) return null;

  if (error) {
    return (
      <Card variant="outlined" padding="$md" borderColor="$error">
        <Text size="$4" color="$error">
          {error}
        </Text>
      </Card>
    );
  }

  if (!connectInstance) {
    return (
      <Column gap="$md" alignItems="center" paddingVertical="$xl">
        <Spinner size="lg" color="$primary" />
        <Text size="$4" color="$textSecondary">
          Loading...
        </Text>
      </Column>
    );
  }

  return (
    <Card
      variant="outlined"
      padding="$md"
      backgroundColor="$surface"
      overflow="hidden"
      width="100%"
    >
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          onExit={onDone}
          collectionOptions={{
            fields: "currently_due",
            futureRequirements: "omit",
            requirements: { only: verificationFields },
          }}
        />
      </ConnectComponentsProvider>
    </Card>
  );
}
