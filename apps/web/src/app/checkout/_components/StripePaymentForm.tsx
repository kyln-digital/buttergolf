"use client";

import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  AddressElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Column, Row, Text, Button, Spinner, Card, Heading } from "@buttergolf/ui";
import { useTheme } from "tamagui";
import { useAuth } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { calculateBuyerProtectionFee, formatPrice } from "@/lib/pricing";
import { Info, Lock, ShieldCheck, Package } from "@tamagui/lucide-icons";

// Initialize Stripe outside component to avoid re-creating on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Shipping options
const SHIPPING_OPTIONS = [
  { id: "standard", name: "Royal Mail Tracked 48", price: 499, days: "2-4 business days" },
  { id: "express", name: "Royal Mail Tracked 24", price: 699, days: "1-2 business days" },
  { id: "nextDay", name: "DPD Next Day", price: 899, days: "Next business day" },
] as const;

type ShippingOptionId = (typeof SHIPPING_OPTIONS)[number]["id"];

interface StripePaymentFormProps {
  productId: string;
  productPrice: number; // In pounds (e.g., 99.99)
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

/**
 * StripePaymentForm component
 *
 * A complete checkout form using Stripe PaymentElement with:
 * - Shipping option selection (shown first)
 * - LinkAuthenticationElement for email (enables Stripe Link)
 * - AddressElement for shipping address
 * - PaymentElement for payment details
 *
 * This is designed to work inside a Sheet/Modal context (no iframes like EmbeddedCheckout)
 */
export function StripePaymentForm({
  productId,
  productPrice,
  onSuccess,
  onError,
  onCancel,
}: StripePaymentFormProps) {
  // Phase 1: Shipping selection (before creating payment intent)
  const [shippingOption, setShippingOption] = useState<ShippingOptionId>("standard");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);

  // Phase 2: Payment form (after payment intent created)
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const theme = useTheme();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const selectedShipping = SHIPPING_OPTIONS.find((o) => o.id === shippingOption)!;
  const buyerProtectionFee = calculateBuyerProtectionFee(productPrice);
  const totalPrice = productPrice + selectedShipping.price / 100 + buyerProtectionFee;

  // Create payment intent when user confirms shipping
  const handleContinueToPayment = useCallback(async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }

    setIsCreatingIntent(true);
    try {
      const response = await fetch("/api/checkout/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          shippingOptionId: shippingOption,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize payment");
      }

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to initialize payment");
    } finally {
      setIsCreatingIntent(false);
    }
  }, [productId, shippingOption, onError, isSignedIn, router, pathname]);

  // Phase 1: Shipping Selection
  if (!clientSecret) {
    return (
      <Column gap="$lg" padding="$md">
        <Heading level={5}>Select Shipping</Heading>

        <Column gap="$sm">
          {SHIPPING_OPTIONS.map((option) => {
            const isSelected = shippingOption === option.id;
            return (
              <Card
                key={option.id}
                variant={isSelected ? "elevated" : "outlined"}
                padding="$md"
                pressStyle={{ scale: 0.98 }}
                onPress={() => setShippingOption(option.id)}
                borderColor={isSelected ? "$primary" : "$border"}
                borderWidth={isSelected ? 2 : 1}
                cursor="pointer"
              >
                <Row justifyContent="space-between" alignItems="center">
                  <Column gap="$xs">
                    <Row gap="$sm" alignItems="center">
                      <Column
                        width={20}
                        height={20}
                        borderRadius="$full"
                        borderWidth={2}
                        borderColor={isSelected ? "$primary" : "$border"}
                        alignItems="center"
                        justifyContent="center"
                      >
                        {isSelected && (
                          <Column
                            width={10}
                            height={10}
                            borderRadius="$full"
                            backgroundColor="$primary"
                          />
                        )}
                      </Column>
                      <Text fontWeight="600" color="$text">
                        {option.name}
                      </Text>
                    </Row>
                    <Text size="$3" color="$textSecondary" marginLeft={28}>
                      {option.days}
                    </Text>
                  </Column>
                  <Text fontWeight="700" color={isSelected ? "$primary" : "$text"}>
                    £{(option.price / 100).toFixed(2)}
                  </Text>
                </Row>
              </Card>
            );
          })}
        </Column>

        {/* Order Summary */}
        <Card variant="filled" padding="$md">
          <Column gap="$sm">
            <Row justifyContent="space-between">
              <Text color="$textSecondary">Subtotal</Text>
              <Text fontWeight="500">£{productPrice.toFixed(2)}</Text>
            </Row>
            <Row justifyContent="space-between">
              <Text color="$textSecondary">Shipping</Text>
              <Text fontWeight="500">£{(selectedShipping.price / 100).toFixed(2)}</Text>
            </Row>
            <Row justifyContent="space-between" alignItems="center">
              <Row gap="$xs" alignItems="center">
                <Text color="$textSecondary">Buyer Protection</Text>
                <div
                  title="Your payment is held securely until you confirm receipt. Includes purchase protection for damaged or missing items."
                  style={{ cursor: "help" }}
                >
                  <Info size={14} color="$textSecondary" />
                </div>
              </Row>
              <Text fontWeight="500">{formatPrice(buyerProtectionFee)}</Text>
            </Row>
            <Row
              justifyContent="space-between"
              paddingTop="$sm"
              borderTopWidth={1}
              borderTopColor="$border"
            >
              <Text fontWeight="700">Total</Text>
              <Text fontWeight="700" size="$6" color="$primary">
                £{totalPrice.toFixed(2)}
              </Text>
            </Row>
          </Column>
        </Card>

        {/* Payment Hold Info Banner */}
        <Card
          variant="outlined"
          padding="$sm"
          borderColor="$success"
          backgroundColor="$successLight"
        >
          <Row gap="$sm" alignItems="center">
            <Lock size={16} color="$success" />
            <Column gap="$xs" flex={1}>
              <Text size="$3" color="$success" fontWeight="600">
                Payment held securely
              </Text>
              <Text size="$2" color="$textSecondary">
                Your money is protected until you confirm you&apos;ve received your item.
              </Text>
            </Column>
          </Row>
        </Card>

        {/* Action Buttons */}
        <Row gap="$md">
          {onCancel && (
            <Button
              flex={1}
              size="$5"
              backgroundColor="transparent"
              borderWidth={2}
              borderColor="$border"
              color="$text"
              onPress={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            butterVariant="primary"
            flex={2}
            size="$5"
            onPress={handleContinueToPayment}
            disabled={isCreatingIntent}
          >
            {isCreatingIntent ? (
              <Row gap="$sm" alignItems="center">
                <Spinner size="sm" color="$textInverse" />
                <Text color="$textInverse">Loading...</Text>
              </Row>
            ) : (
              "Continue to Payment"
            )}
          </Button>
        </Row>
      </Column>
    );
  }

  // Phase 2: Payment Form (wrapped in Elements provider)
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: theme.primary.val,
            colorBackground: theme.surface.val,
            colorText: theme.text.val,
            colorDanger: theme.error.val,
            fontFamily: "Urbanist, system-ui, sans-serif",
            spacingUnit: "4px",
            borderRadius: "10px",
          },
          rules: {
            ".Input": {
              border: `1px solid ${theme.border.val}`,
              boxShadow: "none",
            },
            ".Input:focus": {
              border: `2px solid ${theme.primary.val}`,
              boxShadow: "none",
            },
            ".Label": {
              fontWeight: "500",
              marginBottom: "6px",
              color: theme.text.val,
            },
          },
        },
      }}
    >
      <CheckoutForm
        productPrice={productPrice}
        shippingOption={selectedShipping}
        paymentIntentId={paymentIntentId!}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
        onBack={() => setClientSecret(null)}
      />
    </Elements>
  );
}

// Inner form component that has access to Stripe hooks
interface CheckoutFormProps {
  productPrice: number;
  shippingOption: (typeof SHIPPING_OPTIONS)[number];
  paymentIntentId: string;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  onBack: () => void;
}

function CheckoutForm({
  productPrice,
  shippingOption,
  paymentIntentId,
  onSuccess,
  onError,
  onCancel,
  onBack,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState<{
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null>(null);
  const [hasPhone, setHasPhone] = useState(false);
  const [isEmailComplete, setIsEmailComplete] = useState(false);
  const [isAddressComplete, setIsAddressComplete] = useState(false);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);

  const buyerProtectionFee = calculateBuyerProtectionFee(productPrice);
  const totalPrice = productPrice + shippingOption.price / 100 + buyerProtectionFee;
  const canSubmit =
    stripe &&
    elements &&
    isEmailComplete &&
    isAddressComplete &&
    hasPhone &&
    isPaymentComplete &&
    !isProcessing;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!stripe || !elements) {
      setLocalError("Payment system not ready. Please try again.");
      return;
    }

    setIsProcessing(true);

    try {
      // First, validate all elements
      const { error: submitError } = await elements.submit();
      if (submitError) {
        const message = submitError.message || "Please check your payment details";
        setLocalError(message);
        onError?.(message);
        setIsProcessing(false);
        return;
      }

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success?payment_intent=${paymentIntentId}`,
          payment_method_data: {
            billing_details: {
              email,
              address: shippingAddress
                ? {
                    line1: shippingAddress.line1,
                    line2: shippingAddress.line2 ?? undefined,
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    postal_code: shippingAddress.postal_code,
                    country: shippingAddress.country,
                  }
                : undefined,
            },
          },
        },
        redirect: "if_required", // Only redirect for bank redirects like iDEAL
      });

      if (error) {
        const message = error.message || "Payment failed. Please try again.";
        setLocalError(message);
        onError?.(message);
        setIsProcessing(false);
      } else if (paymentIntent?.status === "succeeded") {
        onSuccess(paymentIntent.id);
      } else if (paymentIntent?.status === "requires_action") {
        // 3DS or other action required - Stripe will handle via redirect
      } else {
        const message = `Unexpected payment status: ${paymentIntent?.status}`;
        setLocalError(message);
        onError?.(message);
        setIsProcessing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setLocalError(message);
      onError?.(message);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Column gap="$lg" padding="$md">
        {/* Navigation actions */}
        <Row gap="$sm" alignSelf="flex-start">
          <Button chromeless size="$3" onPress={onBack}>
            ← Back to shipping
          </Button>
          {onCancel ? (
            <Button chromeless size="$3" onPress={onCancel}>
              Cancel
            </Button>
          ) : null}
        </Row>

        {/* Email - using LinkAuthenticationElement for Stripe Link support */}
        <Column gap="$xs">
          <LinkAuthenticationElement
            options={{
              defaultValues: { email: "" },
            }}
            onChange={(event) => {
              setIsEmailComplete(event.complete);
              if (event.value?.email) {
                setEmail(event.value.email);
              }
            }}
          />
        </Column>

        {/* Shipping Address */}
        <Column gap="$xs">
          <Text fontWeight="500" color="$text">
            Shipping Address
          </Text>
          <AddressElement
            options={{
              mode: "shipping",
              allowedCountries: ["GB"],
              fields: {
                phone: "always",
              },
              validation: {
                phone: {
                  required: "always",
                },
              },
            }}
            onChange={(event) => {
              setIsAddressComplete(event.complete);
              setHasPhone(!!event.value?.phone?.trim());
              if (event.value?.address) {
                setShippingAddress(event.value.address);
              }
            }}
          />
        </Column>

        {/* Payment */}
        <Column gap="$xs">
          <Text fontWeight="500" color="$text">
            Payment
          </Text>
          <PaymentElement
            options={{
              layout: "accordion",
              wallets: {
                applePay: "auto",
                googlePay: "auto",
              },
              fields: {
                billingDetails: {
                  address: "never", // We collect shipping address separately
                },
              },
            }}
            onChange={(event) => {
              setIsPaymentComplete(event.complete);
            }}
          />
        </Column>

        {/* Order Summary */}
        <Card variant="filled" padding="$md">
          <Column gap="$sm">
            <Row justifyContent="space-between">
              <Text color="$textSecondary">Subtotal</Text>
              <Text fontWeight="500">£{productPrice.toFixed(2)}</Text>
            </Row>
            <Row justifyContent="space-between">
              <Text color="$textSecondary">Shipping ({shippingOption.name})</Text>
              <Text fontWeight="500">£{(shippingOption.price / 100).toFixed(2)}</Text>
            </Row>
            <Row justifyContent="space-between" alignItems="center">
              <Row gap="$xs" alignItems="center">
                <Text color="$textSecondary">Buyer Protection</Text>
                <div
                  title="Your payment is held securely until you confirm receipt. Includes purchase protection for damaged or missing items."
                  style={{ cursor: "help" }}
                >
                  <Info size={14} color="$textSecondary" />
                </div>
              </Row>
              <Text fontWeight="500">{formatPrice(buyerProtectionFee)}</Text>
            </Row>
            <Row
              justifyContent="space-between"
              paddingTop="$sm"
              borderTopWidth={1}
              borderTopColor="$border"
            >
              <Text fontWeight="700">Total</Text>
              <Text fontWeight="700" size="$6" color="$primary">
                £{totalPrice.toFixed(2)}
              </Text>
            </Row>
          </Column>
        </Card>

        {/* Inline error */}
        {localError && (
          <Card variant="outlined" padding="$sm" borderColor="$error" backgroundColor="$errorLight">
            <Text size="$3" color="$error">
              {localError}
            </Text>
          </Card>
        )}

        {/* Submit Button */}
        <Button
          size="$6"
          backgroundColor={canSubmit ? "$primary" : "$border"}
          color={canSubmit ? "$textInverse" : "$textSecondary"}
          disabled={!canSubmit}
          onPress={() => {
            // Trigger form submission
            const form = document.querySelector("form");
            if (form) {
              form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
            }
          }}
        >
          {isProcessing ? (
            <Row gap="$sm" alignItems="center" justifyContent="center">
              <Spinner size="sm" color="$textInverse" />
              <Text color="$textInverse" fontWeight="600">
                Processing...
              </Text>
            </Row>
          ) : (
            <Text color={canSubmit ? "$textInverse" : "$textSecondary"} fontWeight="600">
              Pay £{totalPrice.toFixed(2)}
            </Text>
          )}
        </Button>

        {/* Trust badges */}
        <Row gap="$lg" justifyContent="center" flexWrap="wrap">
          <Row gap="$xs" alignItems="center">
            <Lock size={14} color="$textSecondary" />
            <Text size="$2" color="$textSecondary">
              Payment held until receipt
            </Text>
          </Row>
          <Row gap="$xs" alignItems="center">
            <ShieldCheck size={14} color="$textSecondary" />
            <Text size="$2" color="$textSecondary">
              Buyer protection
            </Text>
          </Row>
          <Row gap="$xs" alignItems="center">
            <Package size={14} color="$textSecondary" />
            <Text size="$2" color="$textSecondary">
              Tracked shipping
            </Text>
          </Row>
        </Row>
      </Column>
    </form>
  );
}
