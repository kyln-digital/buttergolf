"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Column, Text, Heading, Button, Card, Spinner, Row, Image, Badge } from "@buttergolf/ui";
import { Lock, ShieldCheck, MapPin, Mail, Check } from "@tamagui/lucide-icons";
import Link from "next/link";
import confetti from "canvas-confetti";

interface OrderDetails {
  id: string;
  productTitle: string;
  productImage: string | null;
  productBrand: string | null;
  amountTotal: number;
  shippingCost: number;
  buyerProtectionFee: number | null;
  paymentHoldStatus: string;
  autoReleaseAt: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  service: string | null;
  orderStatus: string;
  shipmentStatus: string;
  sellerName: string;
  sellerId: string;
  shippingAddress: {
    name: string;
    street1: string;
    street2: string | null;
    city: string;
    state: string | null;
    zip: string;
    country: string;
  };
  createdAt: string;
}

interface ApiResponse {
  status: "complete" | "processing";
  order?: OrderDetails;
  message?: string;
  error?: string;
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const paymentIntentId = searchParams.get("payment_intent");

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [hasConfetti, setHasConfetti] = useState(false);

  // Trigger confetti celebration when order loads
  useEffect(() => {
    if (order && !hasConfetti) {
      setHasConfetti(true);
      // Fire confetti!
      const duration = 2 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#F45314", "#FFFAD2", "#3E3B2C"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#F45314", "#FFFAD2", "#3E3B2C"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [order, hasConfetti]);

  const fetchOrder = useCallback(async () => {
    // Determine which API to call based on available params
    if (!sessionId && !paymentIntentId) {
      setError("No session or payment intent ID provided");
      setLoading(false);
      return;
    }

    try {
      // Use appropriate API endpoint based on available identifier
      const apiUrl = sessionId
        ? `/api/orders/by-session/${sessionId}`
        : `/api/orders/by-payment-intent/${paymentIntentId}`;

      const response = await fetch(apiUrl);
      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch order details");
      }

      if (data.status === "processing") {
        // Order is still being processed, poll again
        setProcessing(true);
        setLoading(false);
        return false; // Indicate we should keep polling
      }

      if (data.status === "complete" && data.order) {
        setOrder(data.order);
        setProcessing(false);
        setLoading(false);
        return true; // Order found, stop polling
      }

      throw new Error("Unexpected response");
    } catch (err) {
      console.error("Error fetching order:", err);
      setError(err instanceof Error ? err.message : "Unable to load order details");
      setLoading(false);
      return true; // Stop polling on error
    }
  }, [sessionId, paymentIntentId]);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setTimeout> | null = null;

    const startFetching = async () => {
      const done = await fetchOrder();

      // If order is still processing, poll every 2 seconds (max 15 times = 30 seconds)
      if (!done && pollCount < 15) {
        pollInterval = setTimeout(() => {
          setPollCount((prev) => prev + 1);
        }, 2000);
      } else if (!done && pollCount >= 15) {
        // Stop polling after 30 seconds
        setError("Order processing is taking longer than expected. Please check your orders page.");
        setProcessing(false);
      }
    };

    startFetching();

    return () => {
      if (pollInterval) clearTimeout(pollInterval);
    };
  }, [fetchOrder, pollCount]);

  // Processing state
  if (processing) {
    return (
      <Column
        gap="$lg"
        alignItems="center"
        justifyContent="center"
        paddingVertical="$3xl"
        paddingHorizontal="$lg"
      >
        <Card variant="elevated" padding="$xl" maxWidth={500}>
          <Column gap="$lg" alignItems="center">
            <Spinner size="lg" color="$primary" />
            <Column gap="$sm" alignItems="center">
              <Heading level={3}>Processing Your Order</Heading>
              <Text color="$textSecondary" textAlign="center">
                Your payment was successful! We&apos;re setting up your order...
              </Text>
            </Column>
          </Column>
        </Card>
      </Column>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Column
        gap="$lg"
        alignItems="center"
        justifyContent="center"
        paddingVertical="$3xl"
        paddingHorizontal="$lg"
      >
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary">Loading your order details...</Text>
      </Column>
    );
  }

  // Error state but payment was likely successful
  if (error || !order) {
    return (
      <Column
        gap="$lg"
        alignItems="center"
        justifyContent="center"
        paddingVertical="$3xl"
        paddingHorizontal="$lg"
      >
        <Card variant="elevated" padding="$xl" maxWidth={500}>
          <Column gap="$lg" alignItems="center">
            <Column
              backgroundColor="$successLight"
              borderRadius="$full"
              padding="$lg"
              alignItems="center"
              justifyContent="center"
              width={64}
              height={64}
            >
              <Check size={24} color="$textInverse" />
            </Column>
            <Column gap="$sm" alignItems="center">
              <Heading level={3}>Payment Successful!</Heading>
              <Text color="$textSecondary" textAlign="center" lineHeight="$5">
                Your payment was processed successfully. You should receive an order confirmation
                email shortly.
              </Text>
            </Column>
            {error && (
              <Text color="$textSecondary" size="$3" textAlign="center" lineHeight="$3">
                {error}
              </Text>
            )}
            <Row gap="$md" marginTop="$md" flexWrap="wrap" justifyContent="center">
              <Link href="/orders" style={{ textDecoration: "none" }}>
                <Button butterVariant="primary" size="$5">
                  View My Orders
                </Button>
              </Link>
              <Link href="/" style={{ textDecoration: "none" }}>
                <Button butterVariant="secondary" size="$5" width="100%" height={56}>
                  Continue Shopping
                </Button>
              </Link>
            </Row>
          </Column>
        </Card>
      </Column>
    );
  }

  return (
    <Column
      gap="$lg"
      alignItems="center"
      justifyContent="center"
      paddingVertical="$3xl"
      paddingHorizontal="$lg"
      minHeight="70vh"
    >
      <Card variant="elevated" padding="$xl" maxWidth={640} fullWidth>
        <Column gap="$lg" alignItems="center">
          {/* Success Icon - Larger and more celebratory */}
          <Column
            backgroundColor="$success"
            borderRadius="$full"
            padding="$lg"
            alignItems="center"
            justifyContent="center"
            width={100}
            height={100}
            animation="bouncy"
            enterStyle={{ scale: 0.5, opacity: 0 }}
            scale={1}
            opacity={1}
          >
            <Check size={40} color="$textInverse" />
          </Column>

          {/* Success Message */}
          <Column gap="$sm" alignItems="center">
            <Heading level={1} textAlign="center">
              Order Confirmed!
            </Heading>
            <Text color="$textSecondary" textAlign="center" size="$5">
              Thank you for your purchase. Your order has been successfully placed.
            </Text>
          </Column>

          {/* Email Confirmation Notice */}
          <Row
            backgroundColor="$successLight"
            borderRadius="$md"
            padding="$md"
            gap="$sm"
            alignItems="center"
            fullWidth
          >
            <Mail size={18} color="$success" />
            <Text size="$4" color="$success" flex={1}>
              A confirmation email has been sent to your inbox
            </Text>
          </Row>

          {/* Product Summary */}
          <Card variant="outlined" padding="$md" fullWidth>
            <Row gap="$md" alignItems="center">
              {order.productImage && (
                <Image
                  source={{ uri: order.productImage }}
                  width={80}
                  height={80}
                  borderRadius="$md"
                  alt={order.productTitle}
                />
              )}
              <Column gap="$xs" flex={1}>
                <Text weight="bold" size="$5" numberOfLines={2}>
                  {order.productTitle}
                </Text>
                {order.productBrand && (
                  <Text size="$4" color="$textSecondary">
                    {order.productBrand}
                  </Text>
                )}
                <Text size="$4" color="$textSecondary">
                  Sold by {order.sellerName}
                </Text>
              </Column>
            </Row>
          </Card>

          {/* Order Progress Tracker */}
          <Column gap="$md" fullWidth paddingVertical="$md">
            <Text weight="semibold" size="$5">
              Order Status
            </Text>
            <Row gap="$sm" alignItems="center" fullWidth>
              {/* Step 1: Payment Confirmed */}
              <Column alignItems="center" flex={1}>
                <Column
                  backgroundColor="$success"
                  borderRadius="$full"
                  width={32}
                  height={32}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Check size={14} color="$textInverse" />
                </Column>
                <Text size="$2" color="$success" textAlign="center" marginTop="$xs">
                  Payment
                </Text>
              </Column>

              {/* Connector */}
              <Column flex={1} height={2} backgroundColor="$border" marginTop={-16} />

              {/* Step 2: Preparing */}
              <Column alignItems="center" flex={1}>
                <Column
                  backgroundColor="$primary"
                  borderRadius="$full"
                  width={32}
                  height={32}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="$textInverse" size="$3">
                    2
                  </Text>
                </Column>
                <Text
                  size="$2"
                  color="$primary"
                  weight="semibold"
                  textAlign="center"
                  marginTop="$xs"
                >
                  Preparing
                </Text>
              </Column>

              {/* Connector */}
              <Column flex={1} height={2} backgroundColor="$border" marginTop={-16} />

              {/* Step 3: Shipped */}
              <Column alignItems="center" flex={1}>
                <Column
                  backgroundColor="$border"
                  borderRadius="$full"
                  width={32}
                  height={32}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="$textSecondary" size="$3">
                    3
                  </Text>
                </Column>
                <Text size="$2" color="$textSecondary" textAlign="center" marginTop="$xs">
                  Shipped
                </Text>
              </Column>

              {/* Connector */}
              <Column flex={1} height={2} backgroundColor="$border" marginTop={-16} />

              {/* Step 4: Delivered */}
              <Column alignItems="center" flex={1}>
                <Column
                  backgroundColor="$border"
                  borderRadius="$full"
                  width={32}
                  height={32}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="$textSecondary" size="$3">
                    4
                  </Text>
                </Column>
                <Text size="$2" color="$textSecondary" textAlign="center" marginTop="$xs">
                  Delivered
                </Text>
              </Column>
            </Row>
          </Column>

          {/* Order Details */}
          <Card variant="outlined" padding="$lg" fullWidth>
            <Column gap="$md">
              <Row justifyContent="space-between" alignItems="center">
                <Text color="$textSecondary">Order ID</Text>
                <Text weight="bold" fontFamily="$body">
                  #{order.id.slice(0, 8).toUpperCase()}
                </Text>
              </Row>

              <Row justifyContent="space-between" alignItems="center">
                <Text color="$textSecondary">Item Price</Text>
                <Text weight="medium">
                  £
                  {(
                    order.amountTotal -
                    order.shippingCost -
                    (order.buyerProtectionFee || 0)
                  ).toFixed(2)}
                </Text>
              </Row>

              <Row justifyContent="space-between" alignItems="center">
                <Text color="$textSecondary">Shipping</Text>
                <Text weight="medium">£{order.shippingCost.toFixed(2)}</Text>
              </Row>

              {order.buyerProtectionFee && order.buyerProtectionFee > 0 && (
                <Row justifyContent="space-between" alignItems="center">
                  <Row gap="$xs" alignItems="center">
                    <Text color="$textSecondary">Buyer Protection</Text>
                    <ShieldCheck size={14} color="$textSecondary" />
                  </Row>
                  <Text weight="medium">£{order.buyerProtectionFee.toFixed(2)}</Text>
                </Row>
              )}

              <Row
                justifyContent="space-between"
                alignItems="center"
                paddingTop="$sm"
                borderTopWidth={1}
                borderTopColor="$border"
              >
                <Text weight="bold" size="$5">
                  Total Paid
                </Text>
                <Text weight="bold" size="$7" color="$primary">
                  £{order.amountTotal.toFixed(2)}
                </Text>
              </Row>

              {/* Estimated Delivery */}
              <Row
                justifyContent="space-between"
                alignItems="center"
                paddingTop="$sm"
                borderTopWidth={1}
                borderTopColor="$border"
              >
                <Text color="$textSecondary">Est. Delivery</Text>
                <Text weight="semibold" color="$success">
                  {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  -{" "}
                  {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </Row>
            </Column>
          </Card>

          {/* Payment Hold Information */}
          {order.paymentHoldStatus === "HELD" && (
            <Card
              variant="outlined"
              padding="$md"
              borderColor="$success"
              backgroundColor="$successLight"
              fullWidth
            >
              <Column gap="$sm">
                <Row gap="$sm" alignItems="center">
                  <Lock size={18} color="$success" />
                  <Text fontWeight="600" color="$success">
                    Payment Held Securely
                  </Text>
                </Row>
                <Text size="$4" color="$textSecondary">
                  Your payment is being held safely until you confirm you&apos;ve received your
                  item. Once delivered, you&apos;ll have 14 days to confirm receipt or report any
                  issues.
                </Text>
                {order.autoReleaseAt && (
                  <Text size="$3" color="$textMuted">
                    Payment auto-releases to seller on{" "}
                    {new Date(order.autoReleaseAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    if no action taken.
                  </Text>
                )}
              </Column>
            </Card>
          )}

          {/* Shipping Address */}
          <Card variant="outlined" padding="$lg" fullWidth>
            <Column gap="$sm">
              <Row gap="$sm" alignItems="center">
                <MapPin size={18} color="$text" />
                <Text weight="semibold">Shipping To</Text>
              </Row>
              <Text color="$textSecondary">{order.shippingAddress.name}</Text>
              <Text color="$textSecondary">
                {order.shippingAddress.street1}
                {order.shippingAddress.street2 && `, ${order.shippingAddress.street2}`}
              </Text>
              <Text color="$textSecondary">
                {order.shippingAddress.city}
                {order.shippingAddress.state && `, ${order.shippingAddress.state}`}{" "}
                {order.shippingAddress.zip}
              </Text>
            </Column>
          </Card>

          {/* Action Buttons - All in one row */}
          <Row gap="$md" marginTop="$md" fullWidth flexWrap="wrap">
            <Link
              href={`/orders/${order.id}`}
              style={{ textDecoration: "none", flex: 1, minWidth: 180 }}
            >
              <Button butterVariant="primary" size="$5" width="100%">
                View Order Details
              </Button>
            </Link>
            <Link
              href={`/orders/${order.id}#messages`}
              style={{ textDecoration: "none", flex: 1, minWidth: 180 }}
            >
              <Button
                size="$5"
                width="100%"
                borderWidth={2}
                borderColor="$primary"
                backgroundColor="transparent"
                color="$primary"
                borderRadius="$full"
              >
                Message Seller
              </Button>
            </Link>
            <Link href="/" style={{ textDecoration: "none", flex: 1, minWidth: 180 }}>
              <Button
                size="$5"
                width="100%"
                borderWidth={2}
                borderColor="$border"
                backgroundColor="transparent"
                color="$text"
                borderRadius="$full"
              >
                Continue Shopping
              </Button>
            </Link>
          </Row>
        </Column>
      </Card>
    </Column>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <Column
          gap="$lg"
          alignItems="center"
          justifyContent="center"
          paddingVertical="$3xl"
          paddingHorizontal="$lg"
        >
          <Spinner size="lg" color="$primary" />
          <Text color="$textSecondary">Loading order details...</Text>
        </Column>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
