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
  SegmentedTabs,
  View,
} from "@buttergolf/ui";
import Image from "next/image";
import { ShoppingBag, Package, Download, ExternalLink } from "@tamagui/lucide-icons";
import { useLinkPress } from "@/hooks/useLinkPress";

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
  labelPngUrl: string | null;
  labelZplUrl: string | null;
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
    imageUrl: string | null;
  };
  buyer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
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
  PRE_TRANSIT: "Label created",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

/** Badge text colour: filled variants read white, tinted ones read dark. */
const BADGE_TEXT_COLOR: Record<BadgeVariant, "$textInverse" | "$text"> = {
  primary: "$textInverse",
  secondary: "$textInverse",
  success: "$text",
  error: "$text",
  warning: "$text",
  info: "$text",
  neutral: "$text",
  outline: "$text",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OrdersList({ orders }: Readonly<OrdersListProps>) {
  const linkPress = useLinkPress();
  const [filter, setFilter] = useState<"all" | "buyer" | "seller">("all");

  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    return order.userRole === filter;
  });

  const purchasesCount = orders.filter((o) => o.userRole === "buyer").length;
  const salesCount = orders.filter((o) => o.userRole === "seller").length;
  const countLabel = `${orders.length} ${orders.length === 1 ? "order" : "orders"}`;

  return (
    <Column
      width="100%"
      maxWidth={1024}
      marginHorizontal="auto"
      paddingHorizontal="$md"
      paddingTop="$lg"
      paddingBottom="$3xl"
      gap="$lg"
      $gtMd={{ paddingHorizontal: "$xl", paddingTop: "$xl" }}
    >
      <Column gap="$xs">
        <Heading level={1} size="$8" color="$text">
          Orders
        </Heading>
        <Text size="$4" color="$textSecondary">
          {countLabel}
        </Text>
      </Column>

      {/* Filter tabs */}
      <SegmentedTabs
        value={filter}
        onValueChange={(val) => setFilter(val as "all" | "buyer" | "seller")}
      >
        <SegmentedTabs.List activeValue={filter}>
          <SegmentedTabs.Tab value="all" count={orders.length}>
            All orders
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

      {filteredOrders.length === 0 ? (
        <Column alignItems="center" gap="$md" paddingVertical="$3xl" role="status">
          <View
            width={72}
            height={72}
            borderRadius="$full"
            backgroundColor="$backgroundHover"
            alignItems="center"
            justifyContent="center"
          >
            <Package size={32} color="$textSecondary" />
          </View>
          <Column alignItems="center" gap="$xs" maxWidth={400}>
            <Heading level={2} size="$6" color="$text" textAlign="center">
              No orders yet
            </Heading>
            <Text size="$4" color="$textSecondary" textAlign="center">
              {filter === "all"
                ? "You haven't made any purchases or sales yet."
                : filter === "buyer"
                  ? "You haven't purchased anything yet."
                  : "You haven't sold anything yet."}
            </Text>
          </Column>
          <Button
            butterVariant="primary"
            size="$5"
            tag="a"
            href="/listings"
            onPress={linkPress("/listings")}
          >
            Start shopping
          </Button>
        </Column>
      ) : (
        <Column gap="$md">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </Column>
      )}
    </Column>
  );
}

function OrderCard({ order }: { order: Order }) {
  const linkPress = useLinkPress();
  const productImage = order.product.images[0]?.url;
  const otherParty = order.userRole === "buyer" ? order.seller : order.buyer;
  const otherPartyName =
    `${otherParty.firstName || ""} ${otherParty.lastName || ""}`.trim() || "User";
  const roleLabel = order.userRole === "buyer" ? "Sold by" : "Purchased by";
  const badgeVariant = STATUS_BADGE_VARIANT[order.shipmentStatus];
  const href = `/orders/${order.id}`;

  return (
    <Card variant="outlined" padding="$md" borderRadius="$lg">
      <Row gap="$md" flexWrap="wrap">
        {/* Product image */}
        <View
          width={96}
          height={96}
          borderRadius="$md"
          overflow="hidden"
          backgroundColor="$backgroundHover"
          flexShrink={0}
        >
          {productImage ? (
            <Image
              src={productImage}
              alt=""
              width={96}
              height={96}
              style={{ objectFit: "cover", width: 96, height: 96 }}
            />
          ) : (
            <View width="100%" height="100%" alignItems="center" justifyContent="center">
              <Text color="$textSecondary" size="$2">
                No image
              </Text>
            </View>
          )}
        </View>

        {/* Order summary */}
        <Column flex={1} gap="$sm" minWidth={200}>
          <Row justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$sm">
            <Column gap={2} flex={1} minWidth={0}>
              <Text size="$5" fontWeight="600" numberOfLines={1} color="$text">
                {order.product.title}
              </Text>
              <Text size="$4" color="$textSecondary">
                {roleLabel} {otherPartyName}
              </Text>
              <Text size="$3" color="$textSecondary">
                Order #{order.id.slice(0, 8)} · {formatDate(order.createdAt)}
              </Text>
            </Column>
            <Column alignItems="flex-end" gap="$xs">
              <Text size="$6" fontWeight="700" color="$text">
                £{order.amountTotal.toFixed(2)}
              </Text>
              <Badge variant={badgeVariant} size="sm">
                <Text size="$2" fontWeight="600" color={BADGE_TEXT_COLOR[badgeVariant]}>
                  {STATUS_LABELS[order.shipmentStatus]}
                </Text>
              </Badge>
            </Column>
          </Row>

          {order.carrier && (
            <Text size="$4" color="$textSecondary">
              {order.carrier}
              {order.service && ` (${order.service})`}
            </Text>
          )}

          {/* Actions: one tonal primary per card, everything else ghost */}
          <Row gap="$sm" flexWrap="wrap" alignItems="center">
            <Button
              butterVariant="secondary"
              size="$3"
              tag="a"
              href={href}
              onPress={linkPress(href)}
            >
              View order
            </Button>
            {order.trackingCode && order.trackingUrl && (
              <Button
                butterVariant="ghost"
                size="$3"
                tag="a"
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                iconAfter={ExternalLink}
              >
                Track parcel
              </Button>
            )}
            {order.userRole === "seller" && order.labelUrl && (
              <Button
                butterVariant="ghost"
                size="$3"
                tag="a"
                href={order.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                icon={Download}
              >
                PDF label
              </Button>
            )}
            {order.userRole === "seller" && order.labelZplUrl && (
              <Button
                butterVariant="ghost"
                size="$3"
                tag="a"
                href={order.labelZplUrl}
                target="_blank"
                rel="noopener noreferrer"
                icon={Download}
              >
                ZPL label
              </Button>
            )}
          </Row>
        </Column>
      </Row>
    </Card>
  );
}
