"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { Column, Row, Text, Heading, Button, Card, Spinner } from "@buttergolf/ui";
import { X, Zap, Star, CheckCircle } from "@tamagui/lucide-icons";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type PromotionType = "BUMP" | "PRO_SHOP_FEATURE";

interface PromotionOption {
  type: PromotionType;
  name: string;
  description: string;
  price: number;
  priceFormatted: string;
  durationFormatted: string;
  icon: typeof Zap;
}

interface PromotionPurchaseSheetProps {
  productId: string;
  productTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PROMOTION_OPTIONS: PromotionOption[] = [
  {
    type: "BUMP",
    name: "Bump",
    description: "24-hour visibility boost - your item appears higher in search and feed",
    price: 0.99,
    priceFormatted: "£0.99",
    durationFormatted: "24 hours",
    icon: Zap,
  },
  {
    type: "PRO_SHOP_FEATURE",
    name: "Pro Shop Feature",
    description: "7-day featured placement - your item showcased in the pro shop section",
    price: 4.99,
    priceFormatted: "£4.99",
    durationFormatted: "7 days",
    icon: Star,
  },
];

function PromotionPaymentForm({
  productId,
  selectedPromotion,
  onSuccess,
  onBack,
}: {
  productId: string;
  selectedPromotion: PromotionOption;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/seller/listings?promotion=success&productId=${productId}`,
        },
      });

      if (submitError) {
        setError(submitError.message || "Payment failed");
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Column gap="$lg">
        {/* Selected Promotion Summary */}
        <Card variant="outlined" padding="$md">
          <Row gap="$md" alignItems="center">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "#FFFAD2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <selectedPromotion.icon size={20} color="#F45314" />
            </div>
            <Column flex={1}>
              <Text size="$5" fontWeight="600">
                {selectedPromotion.name}
              </Text>
              <Text size="$3" color="$textSecondary">
                {selectedPromotion.durationFormatted}
              </Text>
            </Column>
            <Text size="$6" fontWeight="700" color="$primary">
              {selectedPromotion.priceFormatted}
            </Text>
          </Row>
        </Card>

        {/* Payment Element */}
        <Column gap="$sm">
          <Text size="$4" fontWeight="600">
            Payment Details
          </Text>
          <PaymentElement />
        </Column>

        {error && (
          <Card variant="outlined" padding="$md" borderColor="$error">
            <Text color="$error" textAlign="center">
              {error}
            </Text>
          </Card>
        )}

        <Row gap="$md">
          <Button
            size="$4"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$border"
            flex={1}
            onPress={onBack}
            disabled={loading}
          >
            Back
          </Button>
          <Button butterVariant="primary" size="$4" flex={2} disabled={!stripe || loading}>
            {loading ? (
              <Row gap="$sm" alignItems="center">
                <Spinner size="sm" color="$textInverse" />
                <Text color="$textInverse">Processing...</Text>
              </Row>
            ) : (
              `Pay ${selectedPromotion.priceFormatted}`
            )}
          </Button>
        </Row>
      </Column>
    </form>
  );
}

function PromotionPurchaseContent({
  productId,
  productTitle,
  onClose,
  onSuccess,
}: PromotionPurchaseSheetProps) {
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionOption | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSelectPromotion = async (promotion: PromotionOption) => {
    setSelectedPromotion(promotion);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/promotions/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          promotionType: promotion.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create promotion");
      }

      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promotion");
      setSelectedPromotion(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedPromotion(null);
    setClientSecret(null);
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      onSuccess();
    }, 2000);
  };

  if (paymentSuccess) {
    return (
      <Column gap="$lg" alignItems="center" padding="$xl">
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "#e5f7f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle size={40} color="#02aaa4" />
        </div>
        <Heading level={3} textAlign="center">
          Promotion Activated!
        </Heading>
        <Text color="$textSecondary" textAlign="center">
          Your {selectedPromotion?.name} is now active. Your listing will get more visibility!
        </Text>
      </Column>
    );
  }

  return (
    <Column gap="$lg">
      {/* Header */}
      <Row justifyContent="space-between" alignItems="center">
        <Heading level={3}>Boost Your Listing</Heading>
        <Button size="$3" chromeless onPress={onClose} aria-label="Close">
          <X size={24} />
        </Button>
      </Row>

      <Text color="$textSecondary">
        Boost &quot;{productTitle.substring(0, 30)}
        {productTitle.length > 30 ? "..." : ""}&quot; to get more views and sell faster.
      </Text>

      {error && (
        <Card variant="outlined" padding="$md" borderColor="$error">
          <Text color="$error" textAlign="center">
            {error}
          </Text>
        </Card>
      )}

      {/* Promotion Selection */}
      {!selectedPromotion ? (
        <Column gap="$md">
          {PROMOTION_OPTIONS.map((promotion) => (
            <Card
              key={promotion.type}
              variant="outlined"
              padding="$md"
              pressStyle={{ backgroundColor: "$backgroundHover" }}
              cursor="pointer"
              onPress={() => handleSelectPromotion(promotion)}
              borderColor="$border"
              hoverStyle={{ borderColor: "$primary" }}
            >
              <Row gap="$md" alignItems="center">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "#FFFAD2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <promotion.icon size={24} color="#F45314" />
                </div>
                <Column flex={1} gap="$xs">
                  <Row justifyContent="space-between" alignItems="center">
                    <Text size="$5" fontWeight="600">
                      {promotion.name}
                    </Text>
                    <Text size="$5" fontWeight="700" color="$primary">
                      {promotion.priceFormatted}
                    </Text>
                  </Row>
                  <Text size="$3" color="$textSecondary">
                    {promotion.description}
                  </Text>
                  <Text size="$2" color="$textMuted">
                    Duration: {promotion.durationFormatted}
                  </Text>
                </Column>
              </Row>
            </Card>
          ))}
        </Column>
      ) : loading ? (
        <Column gap="$md" alignItems="center" padding="$xl">
          <Spinner size="lg" color="$primary" />
          <Text color="$textSecondary">Setting up payment...</Text>
        </Column>
      ) : clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#F45314",
                borderRadius: "8px",
              },
            },
          }}
        >
          <PromotionPaymentForm
            productId={productId}
            selectedPromotion={selectedPromotion}
            onSuccess={handlePaymentSuccess}
            onBack={handleBack}
          />
        </Elements>
      ) : null}
    </Column>
  );
}

// Helper to safely check if we're in browser
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function PromotionPurchaseSheet(props: PromotionPurchaseSheetProps) {
  // Use useSyncExternalStore to handle SSR/client mismatch safely
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Handle body scroll when sheet is open
  useEffect(() => {
    if (!isMounted) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMounted]);

  if (!isMounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1040,
        }}
        onClick={props.onClose}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          padding: "24px",
          zIndex: 1050,
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <PromotionPurchaseContent {...props} />
      </div>
    </>
  );
}
