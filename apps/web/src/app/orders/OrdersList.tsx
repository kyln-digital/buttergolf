"use client";

import { useState } from "react";
import {
  Button,
  Row,
  Column,
  Text,
  Card,
  Badge,
  Heading,
  Container,
  SegmentedTabs,
} from "@buttergolf/ui";
import { View } from "tamagui";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Package, Eye, Download, ExternalLink } from "@tamagui/lucide-icons";

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

interface Order {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  shipmentStatus: ShipmentStatus;
  amountTotal: number;
  trackingCode: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  carrier: string | null;
  service: string | null;
  userRole: "buyer" | "seller";
  product: {
    id: string;
    title: string;
    images: Array<{
      id: string;
      url: string;
      createdAt: Date;
      productId: string;
      sortOrder: number;
    }>;
  };
  seller: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string | null;
  };
  buyer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string | null;
  };
}

interface OrdersListProps {
  orders: Order[];
}

type BadgeVariant =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral"
  | "outline";

const STATUS_BADGE_VARIANT: Record<ShipmentStatus, BadgeVariant> = {
  PENDING: "neutral",
  PRE_TRANSIT: "info",
  IN_TRANSIT: "warning",
  OUT_FOR_DELIVERY: "primary",
  DELIVERED: "success",
  RETURNED: "error",
  FAILED: "error",
  CANCELLED: "neutral",
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending",
  PRE_TRANSIT: "Label Created",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OrdersList({ orders }: Readonly<OrdersListProps>) {
  const [filter, setFilter] = useState<"all" | "buyer" | "seller">("all");

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    return order.userRole === filter;
  });

  const purchasesCount = orders.filter((o) => o.userRole === "buyer").length;
  const salesCount = orders.filter((o) => o.userRole === "seller").length;

  return (
    <Container size="lg" paddingHorizontal="$md" paddingVertical="$xl">
      <Column gap="$lg">
        <Heading level={1}>My Orders</Heading>

        {/* Filter Tabs */}
        <SegmentedTabs
          value={filter}
          onValueChange={(val) => setFilter(val as "all" | "buyer" | "seller")}
        >
          <SegmentedTabs.List activeValue={filter}>
            <SegmentedTabs.Tab value="all" count={orders.length}>
              All Orders
            </SegmentedTabs.Tab>
            <SegmentedTabs.Tab
              value="buyer"
              icon={<ShoppingBag size={16} color="$textSecondary" />}
              count={purchasesCount}
            >
              Purchases
            </SegmentedTabs.Tab>
            <SegmentedTabs.Tab
              value="seller"
              icon={<Package size={16} color="$textSecondary" />}
              count={salesCount}
            >
              Sales
            </SegmentedTabs.Tab>
          </SegmentedTabs.List>
        </SegmentedTabs>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card variant="outlined" padding="$xl">
            <Column alignItems="center" gap="$md" paddingVertical="$xl">
              <Package size={48} color="var(--color-textMuted)" />
              <Heading level={4} color="$textSecondary">
                No orders found
              </Heading>
              <Text size="$4" color="$textMuted" textAlign="center">
                {filter === "all"
                  ? "You haven't made any purchases or sales yet."
                  : filter === "buyer"
                    ? "You haven't purchased anything yet."
                    : "You haven't sold anything yet."}
              </Text>
              <Link href="/shop" style={{ textDecoration: "none" }}>
                <Button butterVariant="primary" size="$4">
                  Start Shopping
                </Button>
              </Link>
            </Column>
          </Card>
        ) : (
          <Column gap="$md">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </Column>
        )}
      </Column>
    </Container>
  );
}

function OrderCard({ order }: { order: Order }) {
  const productImage = order.product.images[0]?.url;
  const otherParty = order.userRole === "buyer" ? order.seller : order.buyer;
  const otherPartyName =
    `${otherParty.firstName || ""} ${otherParty.lastName || ""}`.trim() || otherParty.email;
  const roleLabel = order.userRole === "buyer" ? "Sold by" : "Purchased by";

  return (
    <Card variant="elevated" padding="$md" interactive>
      <Row gap="$md" flexWrap="wrap">
        {/* Product Image */}
        <View
          width={100}
          height={100}
          borderRadius="$md"
          overflow="hidden"
          backgroundColor="$surface"
          flexShrink={0}
        >
          {productImage ? (
            <Image
              src={productImage}
              alt={order.product.title}
              width={100}
              height={100}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <View
              width="100%"
              height="100%"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$border"
            >
              <Text color="$textMuted" size="$3">
                No image
              </Text>
            </View>
          )}
        </View>

        {/* Order Info */}
        <Column flex={1} gap="$sm" minWidth={200}>
          <Row justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$sm">
            <Column gap="$xs" flex={1}>
              <Text size="$5" fontWeight="600" numberOfLines={1}>
                {order.product.title}
              </Text>
              <Text size="$4" color="$textSecondary">
                {roleLabel} {otherPartyName}
              </Text>
              <Text size="$3" color="$textMuted">
                Order #{order.id.slice(0, 8)} • {formatDate(order.createdAt)}
              </Text>
            </Column>
            <Column alignItems="flex-end" gap="$xs">
              <Text size="$6" fontWeight="700">
                £{order.amountTotal.toFixed(2)}
              </Text>
              <Badge variant={STATUS_BADGE_VARIANT[order.shipmentStatus]} size="sm">
                {STATUS_LABELS[order.shipmentStatus]}
              </Badge>
            </Column>
          </Row>

          {/* Carrier Info */}
          {order.carrier && (
            <Row gap="$sm" alignItems="center" flexWrap="wrap">
              <Text size="$4" color="$textSecondary">
                {order.carrier}
                {order.service && ` (${order.service})`}
              </Text>
              {order.trackingCode && order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <Row gap="$xs" alignItems="center">
                    <Text size="$4" color="$primary" fontWeight="500">
                      Track
                    </Text>
                    <ExternalLink size={14} color="var(--color-primary)" />
                  </Row>
                </a>
              )}
            </Row>
          )}

          {/* Actions */}
          <Row gap="$sm" marginTop="$xs" flexWrap="wrap">
            <Link href={`/orders/${order.id}`} style={{ textDecoration: "none" }}>
              <Button butterVariant="primary" size="$3" icon={<Eye size={14} color="white" />}>
                View Details
              </Button>
            </Link>
            {order.userRole === "seller" && order.labelUrl && (
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <Button
                  size="$3"
                  backgroundColor="$success"
                  color="$textInverse"
                  paddingHorizontal="$md"
                  borderRadius="$md"
                  icon={<Download size={14} color="white" />}
                >
                  Download Label
                </Button>
              </a>
            )}
          </Row>
        </Column>
      </Row>
    </Card>
  );
}
