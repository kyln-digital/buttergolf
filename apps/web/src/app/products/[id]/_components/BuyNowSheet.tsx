"use client";

import { useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@tamagui/sheet";
import { Column, Row, Text, Button, Heading, Image } from "@buttergolf/ui";
import { Lock, Package, CheckCircle } from "@tamagui/lucide-icons";
import { StripePaymentForm } from "@/app/checkout/_components/StripePaymentForm";
import type { Product } from "../ProductDetailClient";

interface BuyNowSheetProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * BuyNowSheet component
 *
 * A Tamagui Sheet with Stripe PaymentElement checkout experience.
 * Uses compound component pattern (Sheet.Overlay, Sheet.Frame) for
 * proper event handling and z-index management.
 */
export function BuyNowSheet({ product, isOpen, onOpenChange }: BuyNowSheetProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);

  // Snap points: 85% for checkout, 50% for summary
  const snapPoints = [85, 50];

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSuccess = useCallback(
    (paymentIntentId: string) => {
      onOpenChange(false);
      router.push(`/checkout/success?payment_intent=${paymentIntentId}`);
    },
    [onOpenChange, router]
  );

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
  }, []);

  return (
    <Sheet
      forceRemoveScrollEnabled={isOpen}
      modal
      open={isOpen}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
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
        elevation={10}
        style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.18)" }}
      >
        <SheetContents
          product={product}
          error={error}
          isOpen={isOpen}
          onClose={handleClose}
          onSuccess={handleSuccess}
          onError={handleError}
          onRetry={handleRetry}
        />
      </Sheet.Frame>
    </Sheet>
  );
}

// Memoize contents to avoid expensive renders during animations
interface SheetContentsProps {
  product: Product;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onRetry: () => void;
}

const SheetContents = memo(function SheetContents({
  product,
  error,
  isOpen,
  onClose,
  onSuccess,
  onError,
  onRetry,
}: SheetContentsProps) {
  const productImageUrl = product.images[0]?.url || null;

  return (
    <Sheet.ScrollView>
      <Column
        p="$4"
        gap="$5"
        width="100%"
        maxWidth={540}
        alignSelf="center"
        $lg={{ paddingHorizontal: "$xl", maxWidth: "65%", width: "65%" }}
        $xl={{ maxWidth: "60%", width: "60%" }}
      >
        {/* Header */}
        <Row justifyContent="space-between" alignItems="center">
          <Heading level={4} color="$text">
            Checkout
          </Heading>
          <Button size="$4" circular backgroundColor="$primary" onPress={onClose}>
            <Text size="$5" fontWeight="bold" color="$textInverse">
              ✕
            </Text>
          </Button>
        </Row>

        {/* Order Summary */}
        <Column gap="$md" pb="$md" borderBottomWidth={1} borderBottomColor="$border">
          <Row gap="$md" alignItems="flex-start">
            {productImageUrl && (
              <Image
                src={productImageUrl}
                width={80}
                height={80}
                borderRadius="$md"
                alt={product.title}
              />
            )}
            <Column gap="$xs" flex={1}>
              <Text size="$5" fontWeight="600" numberOfLines={2} color="$text">
                {product.title}
              </Text>
              {product.brand && (
                <Text size="$3" color="$textSecondary">
                  {product.brand}
                </Text>
              )}
              <Text size="$3" color="$textSecondary">
                Condition: {product.condition.replace("_", " ")}
              </Text>
            </Column>
          </Row>

          <Row justifyContent="space-between" alignItems="center">
            <Text color="$textSecondary">Total</Text>
            <Text fontWeight="bold" size="$7" color="$primary">
              £{product.price.toFixed(2)}
            </Text>
          </Row>

          {/* Trust Badges - Compact */}
          <Row gap="$lg" flexWrap="wrap">
            <Row gap="$xs" alignItems="center">
              <Lock size={14} color="$textSecondary" />
              <Text size="$2" color="$textSecondary">
                Secure checkout
              </Text>
            </Row>
            <Row gap="$xs" alignItems="center">
              <Package size={14} color="$textSecondary" />
              <Text size="$2" color="$textSecondary">
                Tracked shipping
              </Text>
            </Row>
            <Row gap="$xs" alignItems="center">
              <CheckCircle size={14} color="$textSecondary" />
              <Text size="$2" color="$textSecondary">
                Buyer protection
              </Text>
            </Row>
          </Row>
        </Column>

        {/* Stripe Checkout Area */}
        {error ? (
          <Column gap="$lg" alignItems="center" py="$xl">
            <Column
              backgroundColor="$errorLight"
              borderRadius="$full"
              p="$lg"
              alignItems="center"
              justifyContent="center"
              width={64}
              height={64}
            >
              <Text size="$7" color="$error">
                ✕
              </Text>
            </Column>
            <Column gap="$sm" alignItems="center">
              <Heading level={5} textAlign="center">
                Unable to Complete Payment
              </Heading>
              <Text color="$textSecondary" textAlign="center">
                {error}
              </Text>
            </Column>
            <Button butterVariant="primary" size="$4" onPress={onRetry}>
              Try Again
            </Button>
          </Column>
        ) : (
          /* Only render the payment form when sheet is open to avoid premature API calls */
          isOpen && (
            <StripePaymentForm
              productId={product.id}
              productPrice={product.price}
              onSuccess={onSuccess}
              onError={onError}
              onCancel={onClose}
            />
          )
        )}
      </Column>
    </Sheet.ScrollView>
  );
});
