import { useState, useCallback, memo } from "react";
import { Sheet } from "@tamagui/sheet";
import { InteractionManager } from "react-native";
import { Column, Row, Text, Button, Heading, Card, Spinner } from "@buttergolf/ui";
import { Info, Lock, Package, CheckCircle } from "@tamagui/lucide-icons";
import { addBreadcrumb } from "../lib/breadcrumbs";

// Lazy-load Stripe to avoid native module crash in Expo Go
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _useStripe: (() => any) | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _CollectionMode: any = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _AddressCollectionMode: any = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stripeMod = require("@stripe/stripe-react-native");
  _useStripe = stripeMod.useStripe;
  _CollectionMode = stripeMod.CollectionMode;
  _AddressCollectionMode = stripeMod.AddressCollectionMode;
} catch {
  // Stripe native module not available (Expo Go)
}
const CollectionMode = _CollectionMode;
const AddressCollectionMode = _AddressCollectionMode;

// Shipping options matching the web API
const SHIPPING_OPTIONS = [
  { id: "standard", name: "Royal Mail Tracked 48", price: 499, days: "2-4 business days" },
  { id: "express", name: "Royal Mail Tracked 24", price: 699, days: "1-2 business days" },
  { id: "nextDay", name: "DPD Next Day", price: 899, days: "Next business day" },
] as const;

type ShippingOptionId = (typeof SHIPPING_OPTIONS)[number]["id"];

// Calculate buyer protection fee (5% + £0.70 in pence)
function calculateBuyerProtectionFee(priceInPounds: number): number {
  return Math.round(priceInPounds * 0.05 * 100 + 70) / 100;
}

interface MobileCheckoutSheetProps {
  productId: string;
  productTitle: string;
  productPrice: number; // In pounds
  productImageUrl?: string;
  sellerId?: string; // Optional seller ID for the API
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
  /** Function to get auth token for API calls */
  getToken: () => Promise<string | null>;
}

/**
 * MobileCheckoutSheet component
 *
 * A Tamagui Sheet with Stripe Payment Sheet integration for native mobile checkout.
 * Uses @stripe/stripe-react-native for optimal native payment UX.
 */
export function MobileCheckoutSheet({
  productId,
  productTitle,
  productPrice,
  productImageUrl,
  sellerId: _sellerId,
  open,
  onOpenChange,
  onSuccess,
  onError,
  getToken,
}: MobileCheckoutSheetProps) {
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
      snapPoints={[85, 50]}
      snapPointsMode="percent"
      position={position}
      onPositionChange={setPosition}
      dismissOnSnapToBottom
      zIndex={100_000}
      animation="medium"
    >
      <Sheet.Overlay
        animation="lazy"
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
          productImageUrl={productImageUrl}
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

// Memoize contents to avoid expensive renders during animations
interface SheetContentsProps {
  productId: string;
  productTitle: string;
  productPrice: number;
  productImageUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
  getToken: () => Promise<string | null>;
}

const SheetContents = memo(function SheetContents({
  productId,
  productTitle,
  productPrice,
  productImageUrl: _productImageUrl,
  isOpen: _isOpen,
  onClose,
  onSuccess,
  onError,
  getToken,
}: SheetContentsProps) {
  // useStripe is now always available since StripeProvider is at root level
  // Guard against missing native module (Expo Go)
  const stripeHook = _useStripe ? _useStripe() : null;
  const initPaymentSheet = stripeHook?.initPaymentSheet;
  const presentPaymentSheet = stripeHook?.presentPaymentSheet;

  const [shippingOption, setShippingOption] = useState<ShippingOptionId>("standard");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedShipping = SHIPPING_OPTIONS.find((o) => o.id === shippingOption)!;
  const buyerProtectionFee = calculateBuyerProtectionFee(productPrice);
  const totalPrice = productPrice + selectedShipping.price / 100 + buyerProtectionFee;

  const handleCheckout = useCallback(async () => {
    addBreadcrumb("turbomodule.stripe", "Starting checkout flow", { productId });
    setIsProcessing(true);
    setError(null);

    // Defer TurboModule-heavy operations until after any animations complete
    return new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          // 1. Get auth token
          const token = await getToken();
          if (!token) {
            throw new Error("Please sign in to continue");
          }

          const apiUrl = process.env.EXPO_PUBLIC_API_URL;
          if (!apiUrl) {
            throw new Error("API URL not configured");
          }

          // 2. Create payment intent via API
          const response = await fetch(`${apiUrl}/api/checkout/create-payment-intent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              productId,
              shippingOptionId: shippingOption,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to initialize payment");
          }

          addBreadcrumb("turbomodule.stripe", "Payment intent created, initializing sheet");

          // 3. Initialize Stripe Payment Sheet with address collection enabled
          const { error: initError } = await initPaymentSheet({
            paymentIntentClientSecret: data.clientSecret,
            merchantDisplayName: "ButterGolf",
            // Enable address collection
            billingDetailsCollectionConfiguration: {
              address: AddressCollectionMode.FULL,
              email: CollectionMode.ALWAYS,
              name: CollectionMode.ALWAYS,
              phone: CollectionMode.ALWAYS,
            },
            // Apple Pay / Google Pay
            applePay: {
              merchantCountryCode: "GB",
            },
            googlePay: {
              merchantCountryCode: "GB",
              testEnv: __DEV__,
            },
            // Style customization
            appearance: {
              colors: {
                primary: "#F45314", // Spiced Clementine
                background: "#FFFFFF",
                componentBackground: "#FFFFFF",
                componentBorder: "#EDEDED",
                primaryText: "#323232", // Ironstone
                secondaryText: "#545454",
                componentText: "#323232",
                icon: "#545454",
              },
              shapes: {
                borderRadius: 10,
                borderWidth: 1,
              },
            },
            // Return URL for 3DS or bank redirects
            returnURL: "buttergolf://checkout/complete",
          });

          if (initError) {
            throw new Error(initError.message);
          }

          // 4. Present the payment sheet
          const { error: presentError } = await presentPaymentSheet();

          if (presentError) {
            // User cancelled or payment failed
            if (presentError.code === "Canceled") {
              // User cancelled - don't show error
              setIsProcessing(false);
              resolve();
              return;
            }
            throw new Error(presentError.message);
          }

          // 5. Payment succeeded
          onSuccess(data.paymentIntentId);
          onClose();
          resolve();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Payment failed";
          setError(errorMessage);
          onError?.(errorMessage);
          resolve();
        } finally {
          setIsProcessing(false);
        }
      });
    });
  }, [
    initPaymentSheet,
    presentPaymentSheet,
    getToken,
    productId,
    shippingOption,
    onSuccess,
    onError,
    onClose,
  ]);

  const handleRetry = useCallback(() => {
    setError(null);
  }, []);

  if (error) {
    return (
      <Sheet.ScrollView>
        <Column p="$4" gap="$5">
          {/* Error State */}
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
            <Row gap="$md">
              <Button
                flex={1}
                size="$4"
                backgroundColor="transparent"
                borderWidth={2}
                borderColor="$border"
                onPress={onClose}
              >
                <Button.Text color="$text">Cancel</Button.Text>
              </Button>
              <Button butterVariant="primary" flex={1} size="$4" onPress={handleRetry}>
                Try Again
              </Button>
            </Row>
          </Column>
        </Column>
      </Sheet.ScrollView>
    );
  }

  return (
    <Sheet.ScrollView>
      <Column p="$4" gap="$5">
        {/* Header */}
        <Row justifyContent="space-between" alignItems="center">
          <Heading level={4} color="$text">
            Checkout
          </Heading>
          <Button size="$4" circular chromeless onPress={onClose}>
            <Text size="$5" fontWeight="bold" color="$text">
              ✕
            </Text>
          </Button>
        </Row>

        {/* Order Summary */}
        <Column gap="$md" pb="$md" borderBottomWidth={1} borderBottomColor="$border">
          <Column gap="$xs">
            <Text size="$5" fontWeight="600" numberOfLines={2} color="$text">
              {productTitle}
            </Text>
          </Column>

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

        {/* Shipping Selection */}
        <Column gap="$sm">
          <Heading level={5}>Select Shipping</Heading>

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

        {/* Order Total */}
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
                <Info size={14} color="$slateSmoke" />
              </Row>
              <Text fontWeight="500">£{buyerProtectionFee.toFixed(2)}</Text>
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
        <Card variant="outlined" padding="$sm" borderColor="$border" backgroundColor="$surface">
          <Row gap="$sm" alignItems="center">
            <Lock size={16} color="$secondary" />
            <Column gap="$xs" flex={1}>
              <Text size="$3" color="$secondary" fontWeight="600">
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
          <Button
            flex={1}
            size="$5"
            backgroundColor="transparent"
            borderWidth={2}
            borderColor="$border"
            onPress={onClose}
            disabled={isProcessing}
          >
            <Button.Text color="$text">Cancel</Button.Text>
          </Button>
          <Button
            butterVariant="primary"
            flex={2}
            size="$5"
            onPress={handleCheckout}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Row gap="$sm" alignItems="center">
                <Spinner size="sm" color="$textInverse" />
                <Text color="$textInverse">Processing...</Text>
              </Row>
            ) : (
              `Pay £${totalPrice.toFixed(2)}`
            )}
          </Button>
        </Row>
      </Column>
    </Sheet.ScrollView>
  );
});
