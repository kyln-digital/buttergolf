"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Column, Row, Text, Button, Heading, ScrollView, Spinner } from "@buttergolf/ui";
import { Button as TamaguiButton, View } from "tamagui";
import {
  ArrowLeft,
  Package,
  Truck,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  MessageCircle,
  MapPin,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "react-native";

type OrderStatus =
  | "PENDING_SHIPPING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CONFIRMED"
  | "CANCELLED";

interface OrderItem {
  id: string;
  product: {
    id: string;
    title: string;
    images: string[];
  };
  quantity: number;
  price: number;
}

interface SellerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  buyer: {
    id: string;
    name?: string;
    email: string;
  };
  shippingAddress: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
  totalAmount: number;
  platformFee: number;
  sellerEarnings: number;
  hasShippingLabel: boolean;
  trackingNumber?: string;
  carrier?: string;
}

interface SellerSalesResponse {
  orders: SellerOrder[];
  stats: {
    pendingShipping: number;
    shipped: number;
    delivered: number;
    totalEarnings: number;
  };
}

export interface SellerSalesScreenProps {
  /** Fetch seller's orders */
  onFetchSales: (filter?: string) => Promise<SellerSalesResponse>;
  /** Generate shipping label for an order */
  onGenerateLabel: (orderId: string) => Promise<{ labelUrl: string }>;
  /** Download existing shipping label */
  onDownloadLabel: (orderId: string) => Promise<void>;
  /** Mark order as shipped */
  onMarkShipped: (orderId: string, trackingNumber: string, carrier: string) => Promise<void>;
  /** Navigate to order detail */
  onViewOrder: (orderId: string) => void;
  /** Navigate to messages with buyer */
  onMessageBuyer: (buyerId: string, orderId: string) => void;
  /** Navigate back */
  onBack: () => void;
}

type FilterTab = "all" | "pending" | "shipped" | "delivered";

type SalesStatusColorToken = "$warning" | "$info" | "$success" | "$error";
type SalesStatusBgToken = "$warningLight" | "$infoLight" | "$successLight" | "$errorLight";

const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    color: SalesStatusColorToken;
    bgColor: SalesStatusBgToken;
    icon: React.ReactNode;
  }
> = {
  PENDING_SHIPPING: {
    label: "Awaiting Shipment",
    color: "$warning",
    bgColor: "$warningLight",
    icon: <Clock size={16} />,
  },
  SHIPPED: { label: "Shipped", color: "$info", bgColor: "$infoLight", icon: <Truck size={16} /> },
  IN_TRANSIT: {
    label: "In Transit",
    color: "$info",
    bgColor: "$infoLight",
    icon: <Truck size={16} />,
  },
  DELIVERED: {
    label: "Delivered",
    color: "$success",
    bgColor: "$successLight",
    icon: <Check size={16} />,
  },
  CONFIRMED: {
    label: "Completed",
    color: "$success",
    bgColor: "$successLight",
    icon: <Check size={16} />,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "$error",
    bgColor: "$errorLight",
    icon: <AlertCircle size={16} />,
  },
};

export function SellerSalesScreen({
  onFetchSales,
  onGenerateLabel,
  onDownloadLabel,
  onMarkShipped,
  onViewOrder,
  onMessageBuyer,
  onBack,
}: Readonly<SellerSalesScreenProps>) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [stats, setStats] = useState<SellerSalesResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("pending");
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      setError(null);
      const filter = activeFilter === "all" ? undefined : activeFilter;
      const response = await onFetchSales(filter);
      setOrders(response.orders);
      setStats(response.stats);
    } catch (err) {
      console.error("Failed to fetch sales:", err);
      setError("Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, [onFetchSales, activeFilter]);

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  const handleGenerateLabel = useCallback(
    async (order: SellerOrder) => {
      setProcessingOrder(order.id);
      try {
        await onGenerateLabel(order.id);
        Alert.alert(
          "Label Generated",
          "Your shipping label has been created. Download it to print.",
          [
            { text: "Later" },
            {
              text: "Download",
              onPress: () => void onDownloadLabel(order.id),
            },
          ]
        );
        void fetchSales();
      } catch (err) {
        console.error("Failed to generate label:", err);
        Alert.alert("Error", "Failed to generate shipping label. Please try again.");
      } finally {
        setProcessingOrder(null);
      }
    },
    [onGenerateLabel, onDownloadLabel, fetchSales]
  );

  const handleMarkShipped = useCallback(
    (order: SellerOrder) => {
      Alert.prompt(
        "Enter Tracking Number",
        "Please enter the tracking number for this shipment",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Shipped",
            onPress: async (trackingNumber: string | undefined) => {
              if (!trackingNumber?.trim()) {
                Alert.alert("Error", "Please enter a tracking number");
                return;
              }
              setProcessingOrder(order.id);
              try {
                await onMarkShipped(order.id, trackingNumber.trim(), order.carrier || "royal_mail");
                void fetchSales();
              } catch (err) {
                console.error("Failed to mark shipped:", err);
                Alert.alert("Error", "Failed to update order status");
              } finally {
                setProcessingOrder(null);
              }
            },
          },
        ],
        "plain-text",
        order.trackingNumber || ""
      );
    },
    [onMarkShipped, fetchSales]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount / 100);

  // Loading state
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
          Loading sales...
        </Text>
      </Column>
    );
  }

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending", count: stats?.pendingShipping },
    { key: "shipped", label: "Shipped", count: stats?.shipped },
    { key: "delivered", label: "Delivered", count: stats?.delivered },
  ];

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
        <Heading level={4}>My Sales</Heading>
      </Row>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        {filterTabs.map((tab) => (
          <TamaguiButton
            key={tab.key}
            backgroundColor={activeFilter === tab.key ? "$primary" : "$surface"}
            borderRadius="$full"
            paddingHorizontal="$4"
            paddingVertical="$2"
            borderWidth={1}
            borderColor={activeFilter === tab.key ? "$primary" : "$border"}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Row gap="$2" alignItems="center">
              <Text
                size="$3"
                fontWeight="500"
                color={activeFilter === tab.key ? "$textInverse" : "$text"}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  backgroundColor={activeFilter === tab.key ? "$overlayLight20" : "$primary"}
                  borderRadius="$full"
                  paddingHorizontal="$2"
                  minWidth={20}
                  alignItems="center"
                >
                  <Text
                    size="$2"
                    fontWeight="600"
                    color={activeFilter === tab.key ? "$textInverse" : "$textInverse"}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </Row>
          </TamaguiButton>
        ))}
      </ScrollView>

      {error ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center" marginBottom="$4">
            {error}
          </Text>
          <Button butterVariant="primary" size="$4" onPress={() => void fetchSales()}>
            Try Again
          </Button>
        </Column>
      ) : orders.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Package size={64} color="$textMuted" />
          <Text size="$5" color="$textSecondary" marginTop="$4" textAlign="center">
            No {activeFilter === "all" ? "" : activeFilter} orders
          </Text>
          <Text size="$4" color="$textMuted" marginTop="$2" textAlign="center">
            {activeFilter === "pending"
              ? "No orders waiting to be shipped"
              : "Orders will appear here when buyers purchase your items"}
          </Text>
        </Column>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Column gap="$4">
            {orders.map((order) => {
              const config = statusConfig[order.status];
              const isProcessing = processingOrder === order.id;

              return (
                <Column
                  key={order.id}
                  backgroundColor="$surface"
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor="$border"
                  overflow="hidden"
                >
                  {/* Order Header */}
                  <TamaguiButton
                    unstyled
                    padding="$4"
                    borderBottomWidth={1}
                    borderBottomColor="$border"
                    pressStyle={{ backgroundColor: "$backgroundPress" }}
                    onPress={() => onViewOrder(order.id)}
                  >
                    <Row alignItems="center" justifyContent="space-between">
                      <Column gap="$1">
                        <Text size="$3" color="$textSecondary">
                          Order #{order.orderNumber}
                        </Text>
                        <Row alignItems="center" gap="$2">
                          <View
                            backgroundColor={config.bgColor}
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            borderRadius="$sm"
                          >
                            <Row alignItems="center" gap="$1">
                              {config.icon}
                              <Text size="$2" color={config.color} fontWeight="600">
                                {config.label}
                              </Text>
                            </Row>
                          </View>
                        </Row>
                      </Column>
                      <ChevronRight size={20} color="$textMuted" />
                    </Row>
                  </TamaguiButton>

                  {/* Order Items Preview */}
                  <Column padding="$4" gap="$3">
                    {order.items.slice(0, 2).map((item) => (
                      <Row key={item.id} gap="$3" alignItems="center">
                        <View
                          width={60}
                          height={60}
                          borderRadius="$md"
                          backgroundColor="$gray100"
                          overflow="hidden"
                        >
                          {item.product.images[0] && (
                            <View width="100%" height="100%" backgroundColor="$gray200" />
                          )}
                        </View>
                        <Column flex={1}>
                          <Text size="$4" numberOfLines={1}>
                            {item.product.title}
                          </Text>
                          <Text size="$3" color="$textSecondary">
                            Qty: {item.quantity} • {formatCurrency(item.price)}
                          </Text>
                        </Column>
                      </Row>
                    ))}
                    {order.items.length > 2 && (
                      <Text size="$3" color="$textMuted">
                        +{order.items.length - 2} more items
                      </Text>
                    )}

                    {/* Earnings */}
                    <Row
                      backgroundColor="$successLight"
                      borderRadius="$md"
                      padding="$3"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text size="$3" color="$success">
                        Your Earnings
                      </Text>
                      <Text size="$4" fontWeight="700" color="$success">
                        {formatCurrency(order.sellerEarnings)}
                      </Text>
                    </Row>

                    {/* Shipping Address */}
                    <Row gap="$2" alignItems="flex-start">
                      <MapPin size={16} color="$textMuted" />
                      <Column flex={1}>
                        <Text size="$3" color="$textSecondary">
                          Ship to: {order.shippingAddress.name}
                        </Text>
                        <Text size="$2" color="$textMuted">
                          {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                        </Text>
                      </Column>
                    </Row>
                  </Column>

                  {/* Actions */}
                  {order.status === "PENDING_SHIPPING" && (
                    <Row padding="$4" borderTopWidth={1} borderTopColor="$border" gap="$2">
                      {!order.hasShippingLabel ? (
                        <Button
                          butterVariant="primary"
                          size="$4"
                          flex={1}
                          onPress={() => handleGenerateLabel(order)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? "Generating..." : "Generate Label"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="$4"
                            flex={1}
                            backgroundColor="$surface"
                            borderWidth={1}
                            borderColor="$border"
                            onPress={() => void onDownloadLabel(order.id)}
                            icon={<Download size={18} />}
                          >
                            Download Label
                          </Button>
                          <Button
                            butterVariant="primary"
                            size="$4"
                            flex={1}
                            onPress={() => handleMarkShipped(order)}
                            disabled={isProcessing}
                          >
                            Mark Shipped
                          </Button>
                        </>
                      )}
                    </Row>
                  )}

                  {/* Message Buyer */}
                  <Row
                    padding="$3"
                    borderTopWidth={1}
                    borderTopColor="$border"
                    justifyContent="center"
                  >
                    <TamaguiButton
                      chromeless
                      onPress={() => onMessageBuyer(order.buyer.id, order.id)}
                    >
                      <Row alignItems="center" gap="$2">
                        <MessageCircle size={18} color="$primary" />
                        <Text size="$3" color="$primary">
                          Message Buyer
                        </Text>
                      </Row>
                    </TamaguiButton>
                  </Row>
                </Column>
              );
            })}
          </Column>
        </ScrollView>
      )}
    </Column>
  );
}
