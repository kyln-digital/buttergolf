import { useState, useCallback, memo } from "react";
import { Sheet } from "@tamagui/sheet";
import { Column, Row, Text, Button, Heading, Card, Spinner, Input } from "@buttergolf/ui";
import { Lightbulb } from "@tamagui/lucide-icons";

interface MakeOfferSheetProps {
  productId: string;
  productTitle: string;
  productPrice: number; // In pounds - the listing price
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (offer: { id: string }) => void;
  onError?: (error: string) => void;
  /** Function to get auth token for API calls */
  getToken: () => Promise<string | null>;
}

/**
 * MakeOfferSheet component
 *
 * A Tamagui Sheet for submitting an offer on a product.
 * Validates offer amount: must be >= 50% and < 100% of listing price.
 */
export function MakeOfferSheet({
  productId,
  productTitle,
  productPrice,
  open,
  onOpenChange,
  onSuccess,
  onError,
  getToken,
}: MakeOfferSheetProps) {
  const [position, setPosition] = useState(0);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet
      forceRemoveScrollEnabled={open}
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[60, 40]}
      snapPointsMode="percent"
      position={position}
      onPositionChange={setPosition}
      dismissOnSnapToBottom
      zIndex={100_000}
      transition="medium"
    >
      <Sheet.Overlay
        transition="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="$overlayDark50"
      />
      <Sheet.Handle />
      <Sheet.Frame
        backgroundColor="$surface"
        borderTopLeftRadius="$xl"
        borderTopRightRadius="$xl"
        paddingBottom="$xl"
      >
        <SheetContents
          productId={productId}
          productTitle={productTitle}
          productPrice={productPrice}
          isOpen={open}
          onClose={handleClose}
          onSuccess={onSuccess}
          onError={onError}
          getToken={getToken}
        />
      </Sheet.Frame>
    </Sheet>
  );
}

interface SheetContentsProps {
  productId: string;
  productTitle: string;
  productPrice: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (offer: { id: string }) => void;
  onError?: (error: string) => void;
  getToken: () => Promise<string | null>;
}

const SheetContents = memo(function SheetContents({
  productId,
  productTitle,
  productPrice,
  isOpen,
  onClose,
  onSuccess,
  onError,
  getToken,
}: SheetContentsProps) {
  const [offerAmount, setOfferAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minimumOffer = productPrice * 0.5;
  const parsedAmount = parseFloat(offerAmount) || 0;

  // Validation
  const isTooLow = parsedAmount > 0 && parsedAmount < minimumOffer;
  const isTooHigh = parsedAmount >= productPrice;
  const isValidAmount = parsedAmount >= minimumOffer && parsedAmount < productPrice;

  const handleSubmitOffer = useCallback(async () => {
    if (!isValidAmount) {
      setError(
        `Offer must be between £${minimumOffer.toFixed(2)} and £${(productPrice - 0.01).toFixed(2)}`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Get auth token
      const token = await getToken();
      if (!token) {
        throw new Error("Please sign in to make an offer");
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      // 2. Submit offer via API
      const response = await fetch(`${apiUrl}/api/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          amount: parsedAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit offer");
      }

      // 3. Success - navigate to offer detail
      onSuccess({ id: data.id });
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit offer";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidAmount,
    minimumOffer,
    productPrice,
    getToken,
    productId,
    parsedAmount,
    onSuccess,
    onError,
    onClose,
  ]);

  // Quick offer suggestions (70%, 80%, 90% of price)
  const suggestions = [
    { label: "70%", amount: Math.round(productPrice * 0.7 * 100) / 100 },
    { label: "80%", amount: Math.round(productPrice * 0.8 * 100) / 100 },
    { label: "90%", amount: Math.round(productPrice * 0.9 * 100) / 100 },
  ];

  return (
    <Sheet.ScrollView>
      <Column p="$4" gap="$4">
        {/* Header */}
        <Row justifyContent="space-between" alignItems="center">
          <Heading level={4} color="$text">
            Make an Offer
          </Heading>
          <Button size="$4" circular chromeless onPress={onClose}>
            <Text size="$5" fontWeight="bold" color="$text">
              ✕
            </Text>
          </Button>
        </Row>

        {/* Product Info */}
        <Card variant="outlined" padding="$md">
          <Column gap="$xs">
            <Text size="$5" fontWeight="600" numberOfLines={2} color="$text">
              {productTitle}
            </Text>
            <Text size="$6" fontWeight="700" color="$primary">
              Listed at £{productPrice.toFixed(2)}
            </Text>
          </Column>
        </Card>

        {/* Offer Amount Input */}
        <Column gap="$sm">
          <Text fontWeight="600" color="$text">
            Your Offer
          </Text>
          <Row alignItems="center" gap="$sm">
            <Text size="$6" fontWeight="700" color="$text">
              £
            </Text>
            <Input
              flex={1}
              size="md"
              placeholder="0.00"
              inputMode="decimal"
              value={offerAmount}
              onChangeText={setOfferAmount}
              error={!!(isTooLow || isTooHigh)}
            />
          </Row>

          {/* Validation Messages */}
          {isTooLow && (
            <Text size="$3" color="$error">
              Minimum offer is £{minimumOffer.toFixed(2)} (50% of listing price)
            </Text>
          )}
          {isTooHigh && (
            <Text size="$3" color="$error">
              Offer must be less than the listing price
            </Text>
          )}
          {error && (
            <Text size="$3" color="$error">
              {error}
            </Text>
          )}
        </Column>

        {/* Quick Suggestions */}
        <Column gap="$sm">
          <Text size="$3" color="$textSecondary">
            Quick suggestions
          </Text>
          <Row gap="$sm">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.label}
                flex={1}
                size="$3"
                backgroundColor={parsedAmount === suggestion.amount ? "$primary" : "transparent"}
                borderWidth={1}
                borderColor={parsedAmount === suggestion.amount ? "$primary" : "$border"}
                color={parsedAmount === suggestion.amount ? "$textInverse" : "$text"}
                onPress={() => setOfferAmount(suggestion.amount.toFixed(2))}
              >
                <Column alignItems="center">
                  <Text
                    size="$2"
                    color={parsedAmount === suggestion.amount ? "$textInverse" : "$textSecondary"}
                  >
                    {suggestion.label}
                  </Text>
                  <Text
                    size="$3"
                    fontWeight="600"
                    color={parsedAmount === suggestion.amount ? "$textInverse" : "$text"}
                  >
                    £{suggestion.amount.toFixed(2)}
                  </Text>
                </Column>
              </Button>
            ))}
          </Row>
        </Column>

        {/* Info Card */}
        <Card variant="outlined" padding="$sm" borderColor="$info" backgroundColor="$infoLight">
          <Row gap="$sm" alignItems="flex-start">
            <Lightbulb size={16} color="$info" />
            <Column gap="$xs" flex={1}>
              <Text size="$3" color="$info" fontWeight="600">
                How offers work
              </Text>
              <Text size="$2" color="$textSecondary">
                The seller has 7 days to accept, reject, or counter your offer. You&apos;ll be
                notified of their response.
              </Text>
            </Column>
          </Row>
        </Card>

        {/* Action Buttons */}
        <Row gap="$md" marginTop="$sm">
          <Button
            flex={1}
            size="$5"
            backgroundColor="transparent"
            borderWidth={2}
            borderColor="$border"
            color="$text"
            onPress={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            butterVariant="primary"
            flex={2}
            size="$5"
            onPress={handleSubmitOffer}
            disabled={!isValidAmount || isSubmitting}
          >
            {isSubmitting ? (
              <Row gap="$sm" alignItems="center">
                <Spinner size="sm" color="$textInverse" />
                <Text color="$textInverse">Submitting...</Text>
              </Row>
            ) : (
              "Submit Offer"
            )}
          </Button>
        </Row>
      </Column>
    </Sheet.ScrollView>
  );
});
