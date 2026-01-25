"use client";

import { useState } from "react";
import { Button, Card, Column, Input, Text, Row } from "@buttergolf/ui";

interface CounterOfferFormProps {
  offerId: string;
  currentAmount: number; // Current offer amount (to validate against)
  productPrice: number; // Listed price (for validation)
  isUserSeller: boolean; // Determines validation rules
  onSuccess?: () => void;
  disabled?: boolean; // When offer is accepted/rejected/expired
}

/**
 * Form to submit a counter-offer
 * Validates: seller must counter lower, buyer must counter higher
 */
export function CounterOfferForm({
  offerId,
  currentAmount,
  productPrice,
  isUserSeller,
  onSuccess,
  disabled = false,
}: CounterOfferFormProps) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);

    // Client-side validation
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (numericAmount >= productPrice) {
      setError("Counter-offer must be less than listed price");
      return;
    }

    const minimumOffer = productPrice * 0.5;
    if (numericAmount < minimumOffer) {
      setError(`Counter-offer too low (minimum £${minimumOffer.toFixed(2)})`);
      return;
    }

    // Validate seller must counter lower
    if (isUserSeller && numericAmount >= currentAmount) {
      setError("As seller, you must counter lower than the current offer");
      return;
    }

    // Validate buyer must counter higher
    if (!isUserSeller && numericAmount <= currentAmount) {
      setError("As buyer, you must counter higher than the current offer");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/offers/${offerId}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          message: message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit counter-offer");
      }

      // Reset form
      setAmount("");
      setMessage("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (disabled) {
    return null;
  }

  return (
    <Card variant="outlined" padding="$lg">
      <form onSubmit={handleSubmit}>
        <Column gap="$md">
          <Text size="$5" fontWeight="600" color="$text">
            Send Counter-Offer
          </Text>

          {/* Amount input */}
          <Column gap="$xs">
            <Text size="$4" color="$textSecondary">
              Amount
            </Text>
            <Row alignItems="center" gap="$xs">
              <Text size="$5" color="$text">
                £
              </Text>
              <Input
                size="md"
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                fullWidth
                disabled={submitting}
              />
            </Row>
            <Text size="$3" color="$textMuted">
              Current: £{currentAmount.toFixed(2)} | Listed: £
              {productPrice.toFixed(2)}
            </Text>
          </Column>

          {/* Optional message */}
          <Column gap="$xs">
            <Text size="$4" color="$textSecondary">
              Message (optional)
            </Text>
            <Input
              size="md"
              placeholder="Add a message..."
              value={message}
              onChangeText={setMessage}
              fullWidth
              disabled={submitting}
              multiline
              numberOfLines={3}
            />
          </Column>

          {/* Error message */}
          {error && (
            <Text size="$4" color="$error">
              {error}
            </Text>
          )}

          {/* Submit button */}
          <Button
            butterVariant="primary"
            size="$5"
            width="100%"
            disabled={submitting || !amount}
             
            onPress={handleSubmit as unknown as () => void}
          >
            {submitting ? "Sending..." : "Send Counter-Offer"}
          </Button>
        </Column>
      </form>
    </Card>
  );
}
