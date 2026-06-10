"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Column,
  Row,
  Text,
  Button,
  Heading,
  Spinner,
  Image,
  ScrollView,
  Badge,
  View,
} from "@buttergolf/ui";
import { Avatar, TextArea } from "tamagui";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  User,
  MessageCircle,
  Star,
  Download,
  ExternalLink,
  Shield,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency } from "../../utils/format-currency";
import { Alert, Linking } from "react-native";

type OrderStatus =
  | "PAYMENT_CONFIRMED"
  | "LABEL_GENERATED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";
type ShipmentStatus =
  | "PENDING"
  | "PRE_TRANSIT"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RETURNED"
  | "FAILED"
  | "CANCELLED";
type PaymentHoldStatus =
  | "HELD"
  | "PENDING_SELLER_ONBOARDING"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

interface Address {
  id: string;
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

interface OrderProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  condition?: string;
  images: { url: string }[];
  brand?: { name: string };
  model?: { name: string };
}

interface OrderUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
  averageRating?: number;
  ratingCount?: number;
}

interface TrackingEvent {
  status: string;
  statusDetail?: string;
  occurredAt: string;
  carrierOccurredAt?: string;
  description?: string;
  cityLocality?: string;
  stateProvince?: string;
  countryCode?: string;
}

interface Order {
  id: string;
  status: OrderStatus;
  shipmentStatus: ShipmentStatus;
  amountTotal: number;
  shippingCost: number;
  buyerProtectionFee?: number;
  createdAt: string;
  updatedAt: string;
  // Shipping
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  service?: string;
  labelUrl?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  deliveredAt?: string;
  shippedAt?: string;
  labelGeneratedAt?: string;
  // Payment hold (escrow)
  paymentHoldStatus: PaymentHoldStatus;
  paymentHeldAt?: string;
  paymentReleasedAt?: string;
  autoReleaseAt?: string;
  buyerConfirmedAt?: string;
  // Payout
  stripeSellerPayout?: number;
  stripePlatformFee?: number;
  // Relations
  product: OrderProduct;
  seller: OrderUser;
  buyer: OrderUser;
  fromAddress?: Address;
  toAddress?: Address;
  // User role
  userRole?: "buyer" | "seller";
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  senderImage?: string;
  createdAt: string;
  isRead: boolean;
}

export interface SellerRating {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface OrderDetailScreenProps {
  orderId: string;
  currentUserId: string;
  getToken?: () => Promise<string | null>;
  onFetchOrder: (orderId: string) => Promise<Order>;
  onFetchTracking?: (orderId: string) => Promise<{ events: TrackingEvent[] }>;
  onFetchMessages?: (orderId: string) => Promise<{ messages: Message[] }>;
  onSendMessage?: (orderId: string, content: string) => Promise<Message>;
  onConfirmReceipt?: (orderId: string) => Promise<void>;
  onSubmitRating?: (orderId: string, rating: number, comment?: string) => Promise<SellerRating>;
  onGenerateLabel?: (orderId: string) => Promise<{ labelUrl: string }>;
  onDownloadLabel?: (orderId: string) => Promise<void>;
  onMarkShipped?: (orderId: string, trackingNumber: string, carrier: string) => Promise<void>;
  onMessageSeller?: (sellerId: string) => void;
  onMessageBuyer?: (buyerId: string) => void;
  onBack: () => void;
  onViewProduct?: (productId: string) => void;
  onViewMessages?: (orderId: string) => void;
}

function getStatusSteps(status: OrderStatus): { label: string; completed: boolean }[] {
  const steps = [
    { label: "Confirmed", completed: true },
    {
      label: "Label Ready",
      completed: ["LABEL_GENERATED", "SHIPPED", "DELIVERED"].includes(status),
    },
    { label: "Shipped", completed: ["SHIPPED", "DELIVERED"].includes(status) },
    { label: "Delivered", completed: status === "DELIVERED" },
  ];
  return steps;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDaysUntil(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day";
  return `${diffDays} days`;
}

export function OrderDetailScreen({
  orderId,
  currentUserId,

  getToken: _getToken,
  onFetchOrder,
  onFetchTracking,

  onFetchMessages: _onFetchMessages,

  onSendMessage: _onSendMessage,
  onConfirmReceipt,
  onSubmitRating,
  onGenerateLabel,
  onBack,
  onViewProduct,
  onViewMessages,
}: Readonly<OrderDetailScreenProps>) {
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [hasRated, setHasRated] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setError(null);
      const data = await onFetchOrder(orderId);
      setOrder(data);

      // Fetch tracking if available
      if (onFetchTracking && data.trackingCode) {
        try {
          const trackingData = await onFetchTracking(orderId);
          setTrackingEvents(trackingData.events || []);
        } catch {
          console.info("Tracking not available");
        }
      }
    } catch (err) {
      console.error("Failed to fetch order:", err);
      setError("Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [orderId, onFetchOrder, onFetchTracking]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const handleConfirmReceipt = useCallback(async () => {
    if (!onConfirmReceipt) return;

    Alert.alert(
      "Confirm Receipt",
      "Are you sure you've received this item? This will release the payment to the seller.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setActionLoading("confirm");
            try {
              await onConfirmReceipt(orderId);
              void fetchOrder();
              Alert.alert("Success", "Payment has been released to the seller.");
            } catch {
              Alert.alert("Error", "Failed to confirm receipt. Please try again.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [orderId, onConfirmReceipt, fetchOrder]);

  const handleSubmitRating = useCallback(async () => {
    if (!onSubmitRating || rating === 0) return;

    setActionLoading("rating");
    try {
      await onSubmitRating(orderId, rating, ratingComment || undefined);
      setHasRated(true);
      Alert.alert("Thank You", "Your rating has been submitted.");
    } catch {
      Alert.alert("Error", "Failed to submit rating. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }, [orderId, onSubmitRating, rating, ratingComment]);

  const handleGenerateLabel = useCallback(async () => {
    if (!onGenerateLabel) return;

    setActionLoading("label");
    try {
      await onGenerateLabel(orderId);
      void fetchOrder();
      Alert.alert("Success", "Shipping label has been generated.");
    } catch {
      Alert.alert("Error", "Failed to generate label. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }, [orderId, onGenerateLabel, fetchOrder]);

  const handleOpenTracking = useCallback(() => {
    if (order?.trackingUrl) {
      void Linking.openURL(order.trackingUrl);
    }
  }, [order?.trackingUrl]);

  const handleDownloadLabel = useCallback(() => {
    if (order?.labelUrl) {
      void Linking.openURL(order.labelUrl);
    }
  }, [order?.labelUrl]);

  if (loading) {
    return (
      <Column
        flex={1}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        paddingTop={insets.top}
      >
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$3">
          Loading order...
        </Text>
      </Column>
    );
  }

  if (error || !order) {
    return (
      <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <Row
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          gap="$3"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <Button
            chromeless
            circular
            size="$4"
            onPress={onBack}
            icon={<ArrowLeft size={24} color="$text" />}
          />
          <Heading level={4}>Order Details</Heading>
        </Row>
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center">
            {error || "Order not found"}
          </Text>
          <Button butterVariant="primary" size="$4" marginTop="$4" onPress={onBack}>
            Go Back
          </Button>
        </Column>
      </Column>
    );
  }

  const isBuyer = order.buyer.id === currentUserId || order.userRole === "buyer";
  const isSeller = order.seller.id === currentUserId || order.userRole === "seller";
  const otherUser = isBuyer ? order.seller : order.buyer;
  const otherUserName =
    [otherUser.firstName, otherUser.lastName].filter(Boolean).join(" ") || "User";
  const productImage = order.product.images[0]?.url;
  const statusSteps = getStatusSteps(order.status);

  const showConfirmReceipt =
    isBuyer && order.status === "DELIVERED" && order.paymentHoldStatus === "HELD";
  const showRating = isBuyer && order.status === "DELIVERED" && !hasRated && onSubmitRating;
  const showGenerateLabel =
    isSeller && order.status === "PAYMENT_CONFIRMED" && !order.labelUrl && onGenerateLabel;
  const showDownloadLabel = isSeller && order.labelUrl;

  return (
    <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* Header */}
      <Row
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Button
          chromeless
          circular
          size="$4"
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Column flex={1}>
          <Heading level={4}>Order #{order.id.slice(-8).toUpperCase()}</Heading>
          <Text size="$2" color="$textSecondary">
            {formatDate(order.createdAt)}
          </Text>
        </Column>
        <Badge
          backgroundColor={isBuyer ? "$secondary" : "$success"}
          borderRadius="$full"
          paddingHorizontal="$2"
        >
          <Text size="$2" color="$textInverse" fontWeight="600">
            {isBuyer ? "Buyer" : "Seller"}
          </Text>
        </Badge>
      </Row>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Status Steps */}
        <Column
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          marginBottom="$4"
        >
          <Row justifyContent="space-between" alignItems="center">
            {statusSteps.map((step, index) => (
              <Column key={step.label} alignItems="center" flex={1}>
                <View
                  width={28}
                  height={28}
                  borderRadius="$full"
                  backgroundColor={step.completed ? "$primary" : "$gray200"}
                  alignItems="center"
                  justifyContent="center"
                >
                  {step.completed ? (
                    <CheckCircle size={16} color="white" />
                  ) : (
                    <Text size="$2" color="$textMuted">
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  size="$2"
                  color={step.completed ? "$text" : "$textMuted"}
                  marginTop="$1"
                  textAlign="center"
                >
                  {step.label}
                </Text>
              </Column>
            ))}
          </Row>
        </Column>

        {/* Payment Hold Status (Buyer) */}
        {isBuyer && order.paymentHoldStatus === "HELD" && (
          <Column
            backgroundColor="$successLight"
            borderRadius="$lg"
            padding="$4"
            marginBottom="$4"
            gap="$2"
          >
            <Row alignItems="center" gap="$2">
              <Shield size={20} color="$success" />
              <Text size="$4" fontWeight="600" color="$success">
                Payment Protected
              </Text>
            </Row>
            <Text size="$3" color="$text">
              Your payment is held securely until you confirm receipt.
              {order.autoReleaseAt && (
                <Text color="$textSecondary">
                  {" "}
                  Auto-release in {formatDaysUntil(order.autoReleaseAt)}.
                </Text>
              )}
            </Text>
            {showConfirmReceipt && (
              <Button
                butterVariant="primary"
                size="$4"
                marginTop="$2"
                onPress={handleConfirmReceipt}
                disabled={actionLoading === "confirm"}
              >
                {actionLoading === "confirm"
                  ? "Confirming..."
                  : "Confirm Receipt & Release Payment"}
              </Button>
            )}
          </Column>
        )}

        {/* Payment Released */}
        {order.paymentHoldStatus === "RELEASED" && (
          <Column backgroundColor="$gray100" borderRadius="$lg" padding="$4" marginBottom="$4">
            <Row alignItems="center" gap="$2">
              <CheckCircle size={20} color="$success" />
              <Text size="$4" fontWeight="600" color="$success">
                {isBuyer ? "Payment Released" : "Payment Received"}
              </Text>
            </Row>
            {isSeller && order.stripeSellerPayout && (
              <Text size="$3" color="$textSecondary" marginTop="$1">
                You received {formatCurrency(order.stripeSellerPayout)}
              </Text>
            )}
          </Column>
        )}

        {/* Product Card */}
        <Button
          unstyled
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$3"
          marginBottom="$4"
          pressStyle={
            onViewProduct ? { backgroundColor: "$backgroundPress", scale: 0.98 } : undefined
          }
          onPress={onViewProduct ? () => onViewProduct(order.product.id) : undefined}
        >
          <Row gap="$3" alignItems="flex-start">
            {productImage ? (
              <Image
                source={{ uri: productImage }}
                width={90}
                height={90}
                borderRadius="$md"
                backgroundColor="$gray100"
              />
            ) : (
              <View
                width={90}
                height={90}
                borderRadius="$md"
                backgroundColor="$gray100"
                alignItems="center"
                justifyContent="center"
              >
                <Package size={32} color="$textMuted" />
              </View>
            )}
            <Column flex={1} gap="$1">
              <Text size="$4" fontWeight="600" numberOfLines={2}>
                {order.product.title}
              </Text>
              {order.product.brand && (
                <Text size="$3" color="$textSecondary">
                  {order.product.brand.name}
                  {order.product.model && ` ${order.product.model.name}`}
                </Text>
              )}
              {order.product.condition && (
                <Badge backgroundColor="$gray200" alignSelf="flex-start" marginTop="$1">
                  <Text size="$2" color="$text">
                    {order.product.condition}
                  </Text>
                </Badge>
              )}
              {onViewProduct && (
                <Text size="$3" color="$primary" marginTop="$1">
                  View listing →
                </Text>
              )}
            </Column>
          </Row>
        </Button>

        {/* Tracking Info */}
        {order.trackingCode && (
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            marginBottom="$4"
            gap="$3"
          >
            <Row alignItems="center" gap="$2">
              <Truck size={20} color="$primary" />
              <Text size="$4" fontWeight="600">
                Tracking Information
              </Text>
            </Row>

            <Column gap="$2">
              {order.carrier && (
                <Row justifyContent="space-between">
                  <Text size="$3" color="$textSecondary">
                    Carrier
                  </Text>
                  <Text size="$3" fontWeight="500">
                    {order.carrier}
                  </Text>
                </Row>
              )}
              <Row justifyContent="space-between">
                <Text size="$3" color="$textSecondary">
                  Tracking Code
                </Text>
                <Text size="$3" fontWeight="500">
                  {order.trackingCode}
                </Text>
              </Row>
              {order.estimatedDelivery && (
                <Row justifyContent="space-between">
                  <Text size="$3" color="$textSecondary">
                    Est. Delivery
                  </Text>
                  <Text size="$3" fontWeight="500">
                    {formatDate(order.estimatedDelivery)}
                  </Text>
                </Row>
              )}
            </Column>

            {order.trackingUrl && (
              <Button
                size="$4"
                backgroundColor="$surface"
                borderWidth={1}
                borderColor="$primary"
                onPress={handleOpenTracking}
                icon={<ExternalLink size={18} color="$primary" />}
              >
                <Text color="$primary" fontWeight="500">
                  Track Package
                </Text>
              </Button>
            )}

            {/* Tracking Events */}
            {trackingEvents.length > 0 && (
              <Column marginTop="$2" gap="$2">
                <Text size="$3" fontWeight="600" color="$textSecondary">
                  Recent Updates
                </Text>
                {trackingEvents.slice(0, 3).map((event, index) => (
                  <Row key={index} gap="$2" alignItems="flex-start">
                    <View
                      width={8}
                      height={8}
                      borderRadius="$full"
                      backgroundColor={index === 0 ? "$primary" : "$textMuted"}
                      marginTop={6}
                    />
                    <Column flex={1}>
                      <Text size="$3" fontWeight="500">
                        {event.description || event.status}
                      </Text>
                      <Text size="$2" color="$textMuted">
                        {formatDateTime(event.occurredAt)}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Column>
            )}
          </Column>
        )}

        {/* Seller Actions */}
        {isSeller && (
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            marginBottom="$4"
            gap="$3"
          >
            <Text size="$4" fontWeight="600">
              Seller Actions
            </Text>

            {showGenerateLabel && (
              <Button
                butterVariant="primary"
                size="$4"
                onPress={handleGenerateLabel}
                disabled={actionLoading === "label"}
                icon={<Package size={18} />}
              >
                {actionLoading === "label" ? "Generating..." : "Generate Shipping Label"}
              </Button>
            )}

            {showDownloadLabel && (
              <Button
                size="$4"
                backgroundColor="$surface"
                borderWidth={1}
                borderColor="$primary"
                onPress={handleDownloadLabel}
                icon={<Download size={18} color="$primary" />}
              >
                <Text color="$primary" fontWeight="500">
                  Download Shipping Label
                </Text>
              </Button>
            )}

            {!showGenerateLabel && !showDownloadLabel && order.status !== "DELIVERED" && (
              <Text size="$3" color="$textSecondary">
                {order.status === "LABEL_GENERATED"
                  ? "Ship the item and wait for carrier pickup"
                  : order.status === "SHIPPED"
                    ? "Package is on its way to the buyer"
                    : "No actions available"}
              </Text>
            )}
          </Column>
        )}

        {/* Order Summary */}
        <Column
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          marginBottom="$4"
          gap="$2"
        >
          <Text size="$4" fontWeight="600" marginBottom="$1">
            Order Summary
          </Text>

          <Row justifyContent="space-between">
            <Text size="$3" color="$textSecondary">
              Item Price
            </Text>
            <Text size="$3">{formatCurrency(order.product.price)}</Text>
          </Row>

          <Row justifyContent="space-between">
            <Text size="$3" color="$textSecondary">
              Shipping
            </Text>
            <Text size="$3">{formatCurrency(order.shippingCost)}</Text>
          </Row>

          {order.buyerProtectionFee && order.buyerProtectionFee > 0 && (
            <Row justifyContent="space-between">
              <Text size="$3" color="$textSecondary">
                Buyer Protection
              </Text>
              <Text size="$3">{formatCurrency(order.buyerProtectionFee)}</Text>
            </Row>
          )}

          <View height={1} backgroundColor="$border" marginVertical="$2" />

          <Row justifyContent="space-between">
            <Text size="$4" fontWeight="600">
              Total
            </Text>
            <Text size="$5" fontWeight="700" color="$primary">
              {formatCurrency(order.amountTotal)}
            </Text>
          </Row>
        </Column>

        {/* Parties */}
        <Column
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          marginBottom="$4"
          gap="$3"
        >
          <Text size="$4" fontWeight="600">
            {isBuyer ? "Seller" : "Buyer"}
          </Text>

          <Row alignItems="center" gap="$3">
            {otherUser.imageUrl ? (
              <Avatar circular size="$5">
                <Avatar.Image src={otherUser.imageUrl} />
              </Avatar>
            ) : (
              <View
                width={44}
                height={44}
                borderRadius="$full"
                backgroundColor="$gray200"
                alignItems="center"
                justifyContent="center"
              >
                <User size={22} color="$textMuted" />
              </View>
            )}
            <Column flex={1}>
              <Text size="$4" fontWeight="500">
                {otherUserName}
              </Text>
              {otherUser.averageRating !== undefined && otherUser.averageRating > 0 && (
                <Row alignItems="center" gap="$1">
                  <Star size={14} color="$warning" fill="$warning" />
                  <Text size="$3" color="$textSecondary">
                    {otherUser.averageRating.toFixed(1)} ({otherUser.ratingCount} reviews)
                  </Text>
                </Row>
              )}
            </Column>
          </Row>

          {onViewMessages && (
            <Button
              size="$4"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$border"
              onPress={() => onViewMessages(orderId)}
              icon={<MessageCircle size={18} color="$text" />}
            >
              <Text color="$text" fontWeight="500">
                Message {isBuyer ? "Seller" : "Buyer"}
              </Text>
            </Button>
          )}
        </Column>

        {/* Addresses */}
        {(order.fromAddress || order.toAddress) && (
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            marginBottom="$4"
            gap="$3"
          >
            <Text size="$4" fontWeight="600">
              Shipping
            </Text>

            {order.fromAddress && (
              <Column gap="$1">
                <Row alignItems="center" gap="$2">
                  <MapPin size={16} color="$textSecondary" />
                  <Text size="$3" color="$textSecondary">
                    From
                  </Text>
                </Row>
                <Text size="$3">{order.fromAddress.name}</Text>
                <Text size="$3" color="$textSecondary">
                  {order.fromAddress.city}, {order.fromAddress.postalCode}
                </Text>
              </Column>
            )}

            {order.toAddress && (
              <Column gap="$1">
                <Row alignItems="center" gap="$2">
                  <MapPin size={16} color="$primary" />
                  <Text size="$3" color="$textSecondary">
                    To
                  </Text>
                </Row>
                <Text size="$3">{order.toAddress.name}</Text>
                <Text size="$3" color="$textSecondary">
                  {order.toAddress.street1}
                  {order.toAddress.street2 && `, ${order.toAddress.street2}`}
                </Text>
                <Text size="$3" color="$textSecondary">
                  {order.toAddress.city}, {order.toAddress.postalCode}
                </Text>
              </Column>
            )}
          </Column>
        )}

        {/* Rating Section (Buyer only, after delivery) */}
        {showRating && (
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            marginBottom="$4"
            gap="$3"
          >
            <Text size="$4" fontWeight="600">
              Rate Your Experience
            </Text>
            <Text size="$3" color="$textSecondary">
              How was your experience with {otherUserName}?
            </Text>

            <Row gap="$2" justifyContent="center" marginVertical="$2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button key={star} chromeless size="$5" onPress={() => setRating(star)}>
                  <Star
                    size={32}
                    color={rating >= star ? "$warning" : "$textMuted"}
                    fill={rating >= star ? "$warning" : "transparent"}
                  />
                </Button>
              ))}
            </Row>

            <TextArea
              placeholder="Add a comment (optional)"
              value={ratingComment}
              onChangeText={setRatingComment}
              minHeight={80}
              maxLength={500}
            />

            <Button
              butterVariant="primary"
              size="$4"
              onPress={handleSubmitRating}
              disabled={rating === 0 || actionLoading === "rating"}
            >
              {actionLoading === "rating" ? "Submitting..." : "Submit Rating"}
            </Button>
          </Column>
        )}

        {hasRated && (
          <Column
            backgroundColor="$successLight"
            borderRadius="$lg"
            padding="$4"
            marginBottom="$4"
            alignItems="center"
          >
            <CheckCircle size={24} color="$success" />
            <Text size="$4" fontWeight="600" color="$success" marginTop="$2">
              Thank you for your feedback!
            </Text>
          </Column>
        )}
      </ScrollView>
    </Column>
  );
}
