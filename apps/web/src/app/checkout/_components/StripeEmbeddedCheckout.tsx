"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Column, Text, Spinner, Card, Button, Heading } from "@buttergolf/ui";

// Initialize Stripe outside component to avoid re-creating on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeEmbeddedCheckoutProps {
  productId: string;
  offerId?: string | null;
  onError?: (error: string) => void;
}

/**
 * Stripe Embedded Checkout component
 * Renders the full Stripe-hosted checkout experience embedded in our page
 * Handles address collection, shipping selection, and payment in one flow
 */
export function StripeEmbeddedCheckout({
  productId,
  offerId,
  onError,
}: StripeEmbeddedCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch client secret from our API
  const fetchClientSecret = useCallback(async () => {
    try {
      const response = await fetch("/api/checkout/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, ...(offerId && { offerId }) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to create checkout";
        setError(errorMessage);
        onError?.(errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setIsLoading(false);
      return data.clientSecret;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize checkout";
      setError(errorMessage);
      onError?.(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, [productId, offerId, onError]);

  // Handle checkout completion (redirect happens automatically)
  const handleComplete = useCallback(() => {
    // The return_url in the session handles the redirect
    // This callback fires when checkout completes successfully
    console.info("Checkout completed");
  }, []);

  // Error state
  if (error) {
    return (
      <Card variant="outlined" padding="$xl">
        <Column gap="$lg" alignItems="center" paddingVertical="$xl">
          <Column
            backgroundColor="$errorLight"
            borderRadius="$full"
            padding="$lg"
            alignItems="center"
            justifyContent="center"
            width={64}
            height={64}
          >
            <Text size="$7" color="$error">
              ✕
            </Text>
          </Column>
          <Column gap="$sm" alignItems="center" flexShrink={1} width="100%">
            <Heading level={4} textAlign="center">
              Unable to Load Checkout
            </Heading>
            <Text color="$textSecondary" textAlign="center" flexShrink={1} flexWrap="wrap">
              {error}
            </Text>
          </Column>
          <Button
            butterVariant="primary"
            size="$4"
            onPress={() => {
              setError(null);
              setIsLoading(true);
            }}
          >
            Try Again
          </Button>
        </Column>
      </Card>
    );
  }

  return (
    <Column gap="$md" width="100%">
      {isLoading && (
        <Card variant="outlined" padding="$xl">
          <Column gap="$md" alignItems="center" paddingVertical="$xl">
            <Spinner size="lg" color="$primary" />
            <Text color="$textSecondary">Preparing secure checkout...</Text>
          </Column>
        </Card>
      )}

      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          fetchClientSecret,
          onComplete: handleComplete,
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </Column>
  );
}
