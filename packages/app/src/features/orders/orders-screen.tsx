"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Column, Row, Text, Button, Heading, Spinner, Image, ScrollView } from "@buttergolf/ui";
import { Button as TamaguiButton, View } from "tamagui";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, RefreshCw } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type OrderStatus =
  | "PAYMENT_CONFIRMED"
  | "LABEL_GENERATED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";
type PaymentHoldStatus =
  | "HELD"
  | "PENDING_SELLER_ONBOARDING"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

interface OrderProduct {
  id: string;
  title: string;
  price: number;
  images: { url: string }[];
}

interface OrderUser {
  id: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

interface Order {
  id: string;
  status: OrderStatus;
  amountTotal: number;
  shippingCost: number;
  createdAt: string;
  trackingCode?: string;
  carrier?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  paymentHoldStatus: PaymentHoldStatus;
  autoReleaseAt?: string;
  product: OrderProduct;
  seller: OrderUser;
  buyer: OrderUser;
}

interface OrdersResponse {
  orders: Order[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrdersScreenProps {
  /** Current user's ID to determine buyer/seller role */
  currentUserId: string;
  /** Fetch orders list */
  onFetchOrders: () => Promise<OrdersResponse>;
  /** Navigate to order detail */
  onViewOrder: (orderId: string) => void;
  /** Navigate back */
  onBack: () => void;
  /** Navigate to browse products */
  onBrowseProducts?: () => void;
}

type OrderStatusColorToken =
  | "$info"
  | "$warning"
  | "$primary"
  | "$success"
  | "$error"
  | "$textSecondary";

function getStatusConfig(status: OrderStatus): {
  label: string;
  color: OrderStatusColorToken;
  icon: React.ReactNode;
} {
  switch (status) {
    case "PAYMENT_CONFIRMED":
      return { label: "Confirmed", color: "$info", icon: <Clock size={14} color="$info" /> };
    case "LABEL_GENERATED":
      return {
        label: "Label Ready",
        color: "$warning",
        icon: <Package size={14} color="$warning" />,
      };
    case "SHIPPED":
      return { label: "Shipped", color: "$primary", icon: <Truck size={14} color="$primary" /> };
    case "DELIVERED":
      return {
        label: "Delivered",
        color: "$success",
        icon: <CheckCircle size={14} color="$success" />,
      };
    case "CANCELLED":
      return { label: "Cancelled", color: "$error", icon: <Clock size={14} color="$error" /> };
    case "REFUNDED":
      return {
        label: "Refunded",
        color: "$textSecondary",
        icon: <RefreshCw size={14} color="$textSecondary" />,
      };
    default:
      return { label: status, color: "$textSecondary", icon: null };
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

type FilterTab = "all" | "active" | "delivered";

export function OrdersScreen({
  currentUserId,
  onFetchOrders,
  onViewOrder,
  onBack,
  onBrowseProducts,
}: Readonly<OrdersScreenProps>) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const data = await onFetchOrders();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onFetchOrders]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchOrders();
  }, [fetchOrders]);

  // Filter orders based on active tab
  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") {
      return ["PAYMENT_CONFIRMED", "LABEL_GENERATED", "SHIPPED"].includes(order.status);
    }
    if (activeTab === "delivered") {
      return order.status === "DELIVERED";
    }
    return true;
  });

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
          Loading orders...
        </Text>
      </Column>
    );
  }

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
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Heading level={4} flex={1}>
          My Orders
        </Heading>
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={handleRefresh}
          disabled={refreshing}
          icon={<RefreshCw size={20} color={refreshing ? "$textMuted" : "$text"} />}
        />
      </Row>

      {/* Filter Tabs */}
      <Row padding="$3" gap="$2" borderBottomWidth={1} borderBottomColor="$border">
        {(["all", "active", "delivered"] as FilterTab[]).map((tab) => (
          <TamaguiButton
            key={tab}
            size="$3"
            backgroundColor={activeTab === tab ? "$primary" : "$surface"}
            borderWidth={1}
            borderColor={activeTab === tab ? "$primary" : "$border"}
            borderRadius="$full"
            paddingHorizontal="$4"
            onPress={() => setActiveTab(tab)}
          >
            <Text
              size="$3"
              fontWeight="500"
              color={activeTab === tab ? "$textInverse" : "$text"}
              textTransform="capitalize"
            >
              {tab}
            </Text>
          </TamaguiButton>
        ))}
      </Row>

      {error ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center" marginBottom="$4">
            {error}
          </Text>
          <Button butterVariant="primary" size="$4" onPress={handleRefresh}>
            Try Again
          </Button>
        </Column>
      ) : filteredOrders.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Package size={64} color="$textMuted" />
          <Text size="$5" color="$textSecondary" marginTop="$4" textAlign="center">
            {activeTab === "all"
              ? "You haven't made any purchases yet"
              : activeTab === "active"
                ? "No active orders"
                : "No delivered orders"}
          </Text>
          {activeTab === "all" && onBrowseProducts && (
            <Button butterVariant="primary" size="$4" marginTop="$4" onPress={onBrowseProducts}>
              Start Shopping
            </Button>
          )}
        </Column>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Column gap="$3">
            {filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const productImage = order.product.images[0]?.url;
              const isBuyer = order.buyer.id === currentUserId;
              const otherUser = isBuyer ? order.seller : order.buyer;
              const otherUserName =
                [otherUser.firstName, otherUser.lastName].filter(Boolean).join(" ") || "User";

              return (
                <TamaguiButton
                  key={order.id}
                  unstyled
                  backgroundColor="$surface"
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor="$border"
                  padding="$3"
                  pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
                  onPress={() => onViewOrder(order.id)}
                >
                  <Row gap="$3" alignItems="flex-start">
                    {/* Product Image */}
                    {productImage ? (
                      <Image
                        source={{ uri: productImage }}
                        width={80}
                        height={80}
                        borderRadius="$md"
                        backgroundColor="$gray100"
                      />
                    ) : (
                      <View
                        width={80}
                        height={80}
                        borderRadius="$md"
                        backgroundColor="$gray100"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Package size={32} color="$textMuted" />
                      </View>
                    )}

                    {/* Order Details */}
                    <Column flex={1} gap="$1">
                      <Text size="$4" fontWeight="600" numberOfLines={2}>
                        {order.product.title}
                      </Text>

                      <Text size="$3" color="$textSecondary">
                        {isBuyer ? `From ${otherUserName}` : `To ${otherUserName}`}
                      </Text>

                      <Row alignItems="center" gap="$2" marginTop="$1">
                        {statusConfig.icon}
                        <Text size="$3" color={statusConfig.color} fontWeight="500">
                          {statusConfig.label}
                        </Text>
                      </Row>

                      <Row alignItems="center" justifyContent="space-between" marginTop="$2">
                        <Text size="$5" fontWeight="700" color="$primary">
                          {formatCurrency(order.amountTotal)}
                        </Text>
                        <Text size="$2" color="$textMuted">
                          {formatDate(order.createdAt)}
                        </Text>
                      </Row>

                      {/* Payment hold status for buyers */}
                      {isBuyer &&
                        order.status === "DELIVERED" &&
                        order.paymentHoldStatus === "HELD" && (
                          <Row
                            backgroundColor="$warningLight"
                            borderRadius="$sm"
                            padding="$2"
                            marginTop="$2"
                          >
                            <Text size="$2" color="$warning">
                              ⏳ Confirm receipt to release payment
                            </Text>
                          </Row>
                        )}
                    </Column>
                  </Row>
                </TamaguiButton>
              );
            })}
          </Column>
        </ScrollView>
      )}
    </Column>
  );
}
