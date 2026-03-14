import React, { useState, useCallback } from "react";
import { Sheet } from "@tamagui/sheet";
import { Column, Row, Text, Button, Heading, Input } from "@buttergolf/ui";
import { Tag } from "@tamagui/lucide-icons";

interface OfferSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when the sheet open state changes */
  onOpenChange: (open: boolean) => void;
  /** Listed price of the product, used for validation */
  productPrice: number;
  /** Callback when offer is submitted with validated amount */
  onSubmit: (amount: number) => Promise<void>;
}

export function OfferSheet({
  open,
  onOpenChange,
  productPrice,
  onSubmit,
}: Readonly<OfferSheetProps>) {
  const [offerAmount, setOfferAmount] = useState("");
  const [offerError, setOfferError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetState = useCallback(() => {
    setOfferAmount("");
    setOfferError("");
    setSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        resetState();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetState]
  );

  const handleSubmit = useCallback(async () => {
    const amount = Number.parseFloat(offerAmount);

    if (!offerAmount || Number.isNaN(amount) || amount <= 0) {
      setOfferError("Please enter a valid amount");
      return;
    }

    if (amount >= productPrice) {
      setOfferError(`Must be less than £${productPrice.toFixed(2)}`);
      return;
    }

    setOfferError("");
    setSubmitting(true);

    try {
      await onSubmit(amount);
      resetState();
      onOpenChange(false);
    } catch (err) {
      setOfferError(
        err instanceof Error ? err.message : "Failed to submit offer. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [offerAmount, productPrice, onSubmit, resetState, onOpenChange]);

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={handleOpenChange}
      snapPoints={[45]}
      dismissOnSnapToBottom
      zIndex={100_000}
    >
      <Sheet.Overlay
        transition="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.5)"
      />
      <Sheet.Frame
        backgroundColor="$surface"
        borderTopLeftRadius="$xl"
        borderTopRightRadius="$xl"
        padding="$lg"
      >
        <Sheet.Handle backgroundColor="$cloudMist" />

        <Column gap="$lg" paddingTop="$md">
          {/* Header */}
          <Row alignItems="center" gap="$sm">
            <Tag size={20} color="$primary" />
            <Heading level={3}>Make an Offer</Heading>
          </Row>

          {/* Listed price reference */}
          <Text size="$4" color="$textSecondary">
            Listed at £{productPrice.toFixed(2)}
          </Text>

          {/* Amount input */}
          <Column gap="$xs">
            <Row
              alignItems="center"
              borderWidth={1}
              borderColor={offerError ? "$error" : "$border"}
              borderRadius="$md"
              backgroundColor="$surface"
              overflow="hidden"
              focusWithinStyle={{ borderColor: "$primary", borderWidth: 2 }}
            >
              <Text
                paddingLeft="$sm"
                paddingRight="$xs"
                color="$text"
                fontWeight="500"
                userSelect="none"
              >
                £
              </Text>
              <Input
                keyboardType="decimal-pad"
                placeholder="Your offer"
                value={offerAmount}
                onChangeText={(text: string) => {
                  const sanitised = text.replace(/[^0-9.]/g, "").replace(/(\..*?)\./g, "$1");
                  setOfferAmount(sanitised);
                  setOfferError("");
                }}
                disabled={submitting}
                autoFocus
                borderWidth={0}
                flex={1}
                size="$5"
                backgroundColor="transparent"
                onSubmitEditing={handleSubmit}
              />
            </Row>
            {offerError ? (
              <Text size="$3" color="$error">
                {offerError}
              </Text>
            ) : null}
          </Column>

          {/* Action buttons */}
          <Row gap="$md">
            <Button
              flex={1}
              size="$5"
              chromeless
              borderWidth={1}
              borderColor="$border"
              onPress={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              flex={1}
              butterVariant="primary"
              size="$5"
              onPress={handleSubmit}
              disabled={submitting || !offerAmount}
            >
              {submitting ? "Submitting..." : "Submit Offer"}
            </Button>
          </Row>
        </Column>
      </Sheet.Frame>
    </Sheet>
  );
}
