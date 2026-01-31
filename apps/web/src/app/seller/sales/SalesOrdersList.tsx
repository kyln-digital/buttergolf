"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Column, Row, Text, Heading, Button, Card, Spinner } from "@buttergolf/ui";
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  AlertCircle,
  DollarSign,
  Shield,
} from "lucide-react";

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

type PaymentHoldStatus = "HELD" | "RELEASED" | "DISPUTED" | "REFUNDED";

interface Order {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  shipmentStatus: ShipmentStatus;
  amountTotal: number;
  shippingCost: number;
  stripeSellerPayout: number | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  carrier: string | null;
  paymentHoldStatus: PaymentHoldStatus | null;
  autoReleaseAt: Date | null;
  product: {
    id: string;
    title: string;
    price: number;
    images: Array<{ url: string }>;
  };
  buyer: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  toAddress: {
    name: string;
    city: string;
    zip: string;
  };
  fromAddress: {
    street1: string;
  };
}

interface Stats {
  total: number;
  awaitingLabel: number;
  shipped: number;
  delivered: number;
  revenue: number;
}

interface SalesOrdersListProps {
  orders: Order[];
  stats: Stats;
}

const STATUS_CONFIG = {
  PAYMENT_CONFIRMED: {
    label: "Awaiting Label",
    color: "#F45314",
    bgColor: "#FFFAD2",
  },
  LABEL_GENERATED: {
    label: "Ready to Ship",
    color: "#3c50e0",
    bgColor: "#e8ebfc",
  },
  SHIPPED: {
    label: "Shipped",
    color: "#F45314",
    bgColor: "#FFFAD2",
  },
  DELIVERED: {
    label: "Delivered",
    color: "#02aaa4",
    bgColor: "#e5f7f6",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#545454",
    bgColor: "#EDEDED",
  },
  REFUNDED: {
    label: "Refunded",
    color: "#dc2626",
    bgColor: "#fce8e8",
  },
} as const;

const PAYMENT_STATUS_CONFIG = {
  HELD: {
    label: "Payment Held",
    color: "#F45314",
    bgColor: "#FFFAD2",
    icon: Clock,
  },
  RELEASED: {
    label: "Payment Released",
    color: "#02aaa4",
    bgColor: "#e5f7f6",
    icon: CheckCircle,
  },
  DISPUTED: {
    label: "Disputed",
    color: "#dc2626",
    bgColor: "#fce8e8",
    icon: AlertCircle,
  },
  REFUNDED: {
    label: "Refunded",
    color: "#545454",
    bgColor: "#EDEDED",
    icon: AlertCircle,
  },
} as const;

function getStatusIcon(status: OrderStatus) {
  switch (status) {
    case "PAYMENT_CONFIRMED":
      return <Clock size={16} />;
    case "LABEL_GENERATED":
      return <Package size={16} />;
    case "SHIPPED":
      return <Truck size={16} />;
    case "DELIVERED":
      return <CheckCircle size={16} />;
    case "CANCELLED":
    case "REFUNDED":
      return <AlertCircle size={16} />;
    default:
      return <Clock size={16} />;
  }
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card variant="elevated" padding="$md" flex={1} minWidth={150}>
      <Column gap="$sm">
        <Row gap="$sm" alignItems="center">
          {icon}
          <Text size="$3" color="$textSecondary">
            {label}
          </Text>
        </Row>
        <Text size="$8" fontWeight="700">
          {String(value)}
        </Text>
      </Column>
    </Card>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelUrl, setLabelUrl] = useState(order.labelUrl);
  const [trackingCode, setTrackingCode] = useState(order.trackingCode);
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl);
  const [status, setStatus] = useState(order.status);

  const statusConfig = STATUS_CONFIG[status];
  const needsAddressUpdate = order.fromAddress.street1 === "Address pending";
  const paymentStatusConfig = order.paymentHoldStatus
    ? PAYMENT_STATUS_CONFIG[order.paymentHoldStatus]
    : null;
  const PaymentIcon = paymentStatusConfig?.icon || Clock;

  const getDaysUntilAutoRelease = () => {
    if (!order.autoReleaseAt) return null;
    const now = new Date();
    const releaseDate = new Date(order.autoReleaseAt);
    const diffTime = releaseDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysUntilRelease = getDaysUntilAutoRelease();

  const handleGenerateLabel = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/label`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate label");
      }

      setLabelUrl(data.labelUrl);
      setTrackingCode(data.trackingNumber);
      setTrackingUrl(data.trackingUrl);
      setStatus("LABEL_GENERATED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate label");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card variant="elevated" padding="$md">
      <Row gap="$md" flexWrap="wrap">
        {/* Product Image */}
        <Column width={80} height={80} borderRadius="$md" overflow="hidden">
          {order.product.images[0] ? (
            <Image
              src={order.product.images[0].url}
              alt={order.product.title}
              width={80}
              height={80}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <Column
              width={80}
              height={80}
              backgroundColor="$cloudMist"
              alignItems="center"
              justifyContent="center"
            >
              <Package size={24} color="#545454" />
            </Column>
          )}
        </Column>

        {/* Order Details */}
        <Column flex={1} gap="$xs" minWidth={200}>
          <Row gap="$md" alignItems="center" flexWrap="wrap">
            <Text size="$4" fontWeight="600" numberOfLines={1}>
              {order.product.title}
            </Text>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                paddingLeft: "8px",
                paddingRight: "8px",
                paddingTop: "4px",
                paddingBottom: "4px",
                borderRadius: "9999px",
                backgroundColor: statusConfig.bgColor,
                color: statusConfig.color,
              }}
            >
              {getStatusIcon(status)}
              <span style={{ fontSize: "12px", fontWeight: 500 }}>{statusConfig.label}</span>
            </div>
          </Row>

          <Row gap="$lg" flexWrap="wrap">
            <Column gap="$xs">
              <Text size="$2" color="$textMuted">
                Order ID
              </Text>
              <Text size="$3" fontWeight="500">
                {order.id.slice(0, 8).toUpperCase()}
              </Text>
            </Column>
            <Column gap="$xs">
              <Text size="$2" color="$textMuted">
                Buyer
              </Text>
              <Text size="$3">
                {order.buyer.firstName} {order.buyer.lastName}
              </Text>
            </Column>
            <Column gap="$xs">
              <Text size="$2" color="$textMuted">
                Ship To
              </Text>
              <Text size="$3">
                {order.toAddress.city}, {order.toAddress.zip}
              </Text>
            </Column>
            <Column gap="$xs">
              <Text size="$2" color="$textMuted">
                Your Payout
              </Text>
              <Text
                size="$3"
                fontWeight="600"
                color={order.paymentHoldStatus === "RELEASED" ? "$success" : "$text"}
              >
                £{(order.stripeSellerPayout || 0).toFixed(2)}
              </Text>
              {paymentStatusConfig && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    paddingLeft: "6px",
                    paddingRight: "6px",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                    borderRadius: "9999px",
                    backgroundColor: paymentStatusConfig.bgColor,
                    color: paymentStatusConfig.color,
                    marginTop: "4px",
                  }}
                >
                  <PaymentIcon size={12} />
                  <span style={{ fontSize: "11px", fontWeight: 500 }}>
                    {paymentStatusConfig.label}
                  </span>
                </div>
              )}
              {order.paymentHoldStatus === "HELD" && daysUntilRelease !== null && (
                <Text size="$2" color="$textMuted">
                  Auto-releases in {daysUntilRelease} days
                </Text>
              )}
            </Column>
          </Row>

          <Text size="$2" color="$textMuted">
            Ordered {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </Column>

        {/* Actions */}
        <Column gap="$sm" alignItems="flex-end" minWidth={160}>
          {status === "PAYMENT_CONFIRMED" && (
            <>
              {needsAddressUpdate ? (
                <Link href="/seller/settings" style={{ width: "100%" }}>
                  <Button size="$4" backgroundColor="$warning" color="$textInverse" width="100%">
                    <AlertCircle size={16} />
                    <Text color="$textInverse" marginLeft="$xs">
                      Update Address
                    </Text>
                  </Button>
                </Link>
              ) : (
                <Button
                  butterVariant="primary"
                  size="$4"
                  width="100%"
                  onPress={handleGenerateLabel}
                  disabled={generating}
                >
                  {generating ? (
                    <Spinner size="sm" color="$textInverse" />
                  ) : (
                    <>
                      <Package size={16} />
                      <Text color="$textInverse" marginLeft="$xs">
                        Generate Label
                      </Text>
                    </>
                  )}
                </Button>
              )}
              {error && (
                <Text size="$2" color="$error" textAlign="center">
                  {error}
                </Text>
              )}
            </>
          )}

          {labelUrl && (
            <a href={labelUrl} target="_blank" rel="noopener noreferrer" style={{ width: "100%" }}>
              <Button size="$4" backgroundColor="$success" color="$textInverse" width="100%">
                <Download size={16} />
                <Text color="$textInverse" marginLeft="$xs">
                  Download Label
                </Text>
              </Button>
            </a>
          )}

          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ width: "100%" }}
            >
              <Button
                size="$4"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="transparent"
                width="100%"
              >
                <ExternalLink size={16} />
                <Text marginLeft="$xs">Track: {trackingCode?.slice(0, 10)}...</Text>
              </Button>
            </a>
          )}

          <Link href={`/orders/${order.id}`} style={{ width: "100%", textDecoration: "none" }}>
            <Button size="$3" chromeless width="100%">
              View Details →
            </Button>
          </Link>
        </Column>
      </Row>
    </Card>
  );
}

export function SalesOrdersList({ orders, stats }: SalesOrdersListProps) {
  const [filter, setFilter] = useState<"all" | "awaiting" | "shipped" | "delivered">("all");

  const filteredOrders = orders.filter((order) => {
    switch (filter) {
      case "awaiting":
        return order.status === "PAYMENT_CONFIRMED";
      case "shipped":
        return order.status === "LABEL_GENERATED" || order.status === "SHIPPED";
      case "delivered":
        return order.status === "DELIVERED";
      default:
        return true;
    }
  });

  return (
    <Column gap="$lg" fullWidth>
      {/* Header */}
      <Row justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$md">
        <Heading level={2}>Sales</Heading>
        <Text color="$textSecondary">Manage your orders and shipping</Text>
      </Row>

      {/* Stats */}
      <Row gap="$md" flexWrap="wrap">
        <StatCard
          label="Total Orders"
          value={stats.total}
          icon={<Package size={20} color="#F45314" />}
        />
        <StatCard
          label="Awaiting Label"
          value={stats.awaitingLabel}
          icon={<Clock size={20} color="#F45314" />}
        />
        <StatCard
          label="Shipped"
          value={stats.shipped}
          icon={<Truck size={20} color="#3c50e0" />}
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          icon={<CheckCircle size={20} color="#02aaa4" />}
        />
        <StatCard
          label="Total Revenue"
          value={`£${stats.revenue.toFixed(2)}`}
          icon={<CheckCircle size={20} color="#02aaa4" />}
        />
      </Row>

      {/* Filter Tabs */}
      <Row gap="$sm" flexWrap="wrap">
        {(
          [
            { key: "all", label: "All Orders" },
            { key: "awaiting", label: "Awaiting Label" },
            { key: "shipped", label: "Shipped" },
            { key: "delivered", label: "Delivered" },
          ] as const
        ).map(({ key, label }) => (
          <Button
            key={key}
            size="$4"
            backgroundColor={filter === key ? "$primary" : "transparent"}
            color={filter === key ? "$textInverse" : "$text"}
            borderWidth={filter === key ? 0 : 1}
            borderColor="$border"
            onPress={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </Row>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card variant="outlined" padding="$xl">
          <Column alignItems="center" gap="$md">
            <Package size={48} color="#545454" />
            <Text color="$textSecondary" textAlign="center">
              {filter === "all"
                ? "No orders yet. Once you make a sale, it will appear here."
                : `No orders in "${filter}" status.`}
            </Text>
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
  );
}
