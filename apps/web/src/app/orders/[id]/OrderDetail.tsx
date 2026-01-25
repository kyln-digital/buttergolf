"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { OrderMessages } from "./OrderMessages";
import { OrderRating } from "./OrderRating";
import { AnimationErrorBoundary } from "@/app/_components/ErrorBoundary";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import {
  Card,
  Text,
  Column,
  Row,
  Heading,
  Badge,
  Button,
  Separator,
  Container,
} from "@buttergolf/ui";
import { View } from "tamagui";
import { buildTrackingUrl } from "@/lib/utils/format";
import {
  Package,
  Truck,
  CheckCircle,
  Tag,
  MapPin,
  User,
  ArrowLeft,
  Download,
  ExternalLink,
  RefreshCw,
  Clock,
  Shield,
  DollarSign,
} from "@tamagui/lucide-icons";

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
  updatedAt: Date;
  status: OrderStatus;
  shipmentStatus: ShipmentStatus;
  amountTotal: number;
  shippingCost: number;
  buyerProtectionFee: number | null;
  paymentHoldStatus: PaymentHoldStatus;
  autoReleaseAt: Date | null;
  paymentReleasedAt: Date | null;
  buyerConfirmedAt: Date | null;
  stripeSellerPayout: number | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  carrier: string | null;
  service: string | null;
  estimatedDelivery: Date | null;
  deliveredAt: Date | null;
  shippedAt: Date | null;
  labelGeneratedAt: Date | null;
  userRole: "buyer" | "seller";
  currentUserId: string;
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    condition: string;
    brand: string | null;
    model: string | null;
    images: Array<{ url: string }>;
    category: {
      name: string;
    };
  };
  seller: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string | null;
  };
  buyer: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string | null;
  };
  fromAddress: {
    name: string;
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string | null;
  };
  toAddress: {
    name: string;
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string | null;
  };
}

interface OrderDetailProps {
  order: Order;
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
  PENDING: "Pending Label",
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

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineItem({
  label,
  date,
  icon: Icon,
}: {
  label: string;
  date: Date;
  icon: React.ElementType;
}) {
  return (
    <Row gap="$md" alignItems="flex-start">
      <View
        width={32}
        height={32}
        borderRadius={16}
        backgroundColor="$success"
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={16} color="white" />
      </View>
      <Column gap="$xs">
        <Text fontWeight="600" size="$5">
          {label}
        </Text>
        <Text size="$4" color="$textSecondary">
          {formatDateTime(date)}
        </Text>
      </Column>
    </Row>
  );
}

function AddressBlock({ title, address }: { title: string; address: Order["fromAddress"] }) {
  return (
    <Column gap="$sm" flex={1} minWidth={200}>
      <Row gap="$xs" alignItems="center">
        <MapPin size={16} color="var(--color-textSecondary)" />
        <Text fontWeight="600" size="$5">
          {title}
        </Text>
      </Row>
      <Column gap="$xs" paddingLeft="$lg">
        <Text size="$4" color="$textSecondary">
          {address.name}
        </Text>
        <Text size="$4" color="$textSecondary">
          {address.street1}
        </Text>
        {address.street2 && (
          <Text size="$4" color="$textSecondary">
            {address.street2}
          </Text>
        )}
        <Text size="$4" color="$textSecondary">
          {address.city}, {address.state} {address.zip}
        </Text>
        <Text size="$4" color="$textSecondary">
          {address.country}
        </Text>
        {address.phone && (
          <Text size="$4" color="$textSecondary">
            {address.phone}
          </Text>
        )}
      </Column>
    </Column>
  );
}

function ParticipantCard({ title, user }: { title: string; user: Order["seller"] }) {
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  return (
    <Column gap="$sm" flex={1} minWidth={200}>
      <Row gap="$xs" alignItems="center">
        <User size={16} color="var(--color-textSecondary)" />
        <Text fontWeight="600" size="$5">
          {title}
        </Text>
      </Row>
      <Row gap="$md" alignItems="center" paddingLeft="$lg">
        {user.imageUrl && (
          <Image
            src={user.imageUrl}
            alt={fullName}
            width={40}
            height={40}
            className="rounded-full"
          />
        )}
        <Column gap="$xs">
          <Text fontWeight="500" size="$5">
            {fullName}
          </Text>
          <Text size="$4" color="$textSecondary">
            {user.email}
          </Text>
        </Column>
      </Row>
    </Column>
  );
}

interface TrackingEvent {
  occurred_at: string;
  carrier_occurred_at: string;
  description: string;
  city_locality: string;
  state_province: string;
  postal_code: string;
  country_code: string;
  company_name?: string;
  signer?: string;
  event_code?: string;
}

export function OrderDetail({ order: initialOrder }: OrderDetailProps) {
  const [order, setOrder] = useState(initialOrder);
  const productImage = order.product.images[0]?.url;
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Confirm receipt state
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [confirmReceiptError, setConfirmReceiptError] = useState<string | null>(null);
  const [confirmReceiptSuccess, setConfirmReceiptSuccess] = useState(false);

  // Handle confirm receipt
  const handleConfirmReceipt = async () => {
    if (
      !confirm("Confirm you have received your item? This will release the payment to the seller.")
    ) {
      return;
    }

    setIsConfirmingReceipt(true);
    setConfirmReceiptError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/confirm-receipt`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm receipt");
      }

      setConfirmReceiptSuccess(true);
      // Update local order state
      setOrder((prev) => ({
        ...prev,
        paymentHoldStatus: "RELEASED" as const,
        paymentReleasedAt: new Date(),
        buyerConfirmedAt: new Date(),
      }));
    } catch (error) {
      console.error("Error confirming receipt:", error);
      setConfirmReceiptError(error instanceof Error ? error.message : "Failed to confirm receipt");
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  // Calculate days until auto-release
  const getDaysUntilAutoRelease = () => {
    if (!order.autoReleaseAt) return null;
    const now = new Date();
    const autoRelease = new Date(order.autoReleaseAt);
    const diffTime = autoRelease.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Fetch tracking events on mount
  const fetchTrackingEvents = async () => {
    if (!order.trackingCode) return;

    setIsLoadingTracking(true);
    setTrackingError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/tracking`);

      if (!response.ok) {
        throw new Error("Failed to fetch tracking information");
      }

      const data = await response.json();
      setTrackingEvents(data.events || []);
    } catch (error) {
      console.error("Error fetching tracking:", error);
      setTrackingError(error instanceof Error ? error.message : "Failed to load tracking");
    } finally {
      setIsLoadingTracking(false);
    }
  };

  // Fetch tracking events on mount
  useEffect(() => {
    fetchTrackingEvents();
  }, [order.id, order.trackingCode]);

  // Poll for updates when shipment is active (IN_TRANSIT or OUT_FOR_DELIVERY)
  useEffect(() => {
    const isActiveShipment =
      order.shipmentStatus === "IN_TRANSIT" || order.shipmentStatus === "OUT_FOR_DELIVERY";

    if (!isActiveShipment || !order.trackingCode) return;

    // Poll every 15 seconds
    const interval = setInterval(() => {
      fetchTrackingEvents();
    }, 15000);

    return () => clearInterval(interval);
  }, [order.shipmentStatus, order.trackingCode, order.id]);

  return (
    <Container size="lg" paddingHorizontal="$md" paddingVertical="$xl">
      <Column gap="$lg">
        {/* Back Link */}
        <Link href="/orders" style={{ textDecoration: "none" }}>
          <Row gap="$xs" alignItems="center" hoverStyle={{ opacity: 0.7 }}>
            <ArrowLeft size={18} color="var(--color-primary)" />
            <Text color="$primary" fontWeight="500">
              Back to Orders
            </Text>
          </Row>
        </Link>

        {/* Order Header Card */}
        <Card variant="elevated" padding="$lg">
          <Row justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$md">
            <Column gap="$xs">
              <Heading level={2}>Order Details</Heading>
              <Text size="$4" color="$textSecondary">
                Order #{order.id}
              </Text>
              <Text size="$4" color="$textSecondary">
                Placed on {formatDateTime(order.createdAt)}
              </Text>
            </Column>
            <Badge variant={STATUS_BADGE_VARIANT[order.shipmentStatus]} size="lg">
              {STATUS_LABELS[order.shipmentStatus]}
            </Badge>
          </Row>
        </Card>

        {/* Product Info Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$md">
            <Row gap="$xs" alignItems="center">
              <Package size={20} color="var(--color-text)" />
              <Heading level={3}>Product</Heading>
            </Row>

            <Row gap="$lg" flexWrap="wrap">
              {/* Product Image */}
              <View
                width={150}
                height={150}
                borderRadius="$md"
                overflow="hidden"
                backgroundColor="$surface"
              >
                {productImage ? (
                  <Image
                    src={productImage}
                    alt={order.product.title}
                    width={150}
                    height={150}
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
                    <Text color="$textMuted" size="$4">
                      No image
                    </Text>
                  </View>
                )}
              </View>

              {/* Product Details */}
              <Column gap="$sm" flex={1} minWidth={200}>
                <Link href={`/products/${order.product.id}`} style={{ textDecoration: "none" }}>
                  <Text size="$6" fontWeight="600" color="$primary" hoverStyle={{ opacity: 0.8 }}>
                    {order.product.title}
                  </Text>
                </Link>
                <Text size="$4" color="$textSecondary" numberOfLines={2}>
                  {order.product.description}
                </Text>

                <Column gap="$xs" marginTop="$sm">
                  <Row gap="$sm">
                    <Text size="$4" fontWeight="500" width={80}>
                      Category:
                    </Text>
                    <Text size="$4" color="$textSecondary">
                      {order.product.category.name}
                    </Text>
                  </Row>
                  <Row gap="$sm" alignItems="center">
                    <Text size="$4" fontWeight="500" width={80}>
                      Condition:
                    </Text>
                    <Badge variant="outline" size="sm">
                      {order.product.condition.replace(/_/g, " ")}
                    </Badge>
                  </Row>
                  {order.product.brand && (
                    <Row gap="$sm">
                      <Text size="$4" fontWeight="500" width={80}>
                        Brand:
                      </Text>
                      <Text size="$4" color="$textSecondary">
                        {order.product.brand}
                      </Text>
                    </Row>
                  )}
                  {order.product.model && (
                    <Row gap="$sm">
                      <Text size="$4" fontWeight="500" width={80}>
                        Model:
                      </Text>
                      <Text size="$4" color="$textSecondary">
                        {order.product.model}
                      </Text>
                    </Row>
                  )}
                </Column>
              </Column>
            </Row>
          </Column>
        </Card>

        {/* Shipping Information Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$md">
            <Row gap="$xs" alignItems="center">
              <Truck size={20} color="var(--color-text)" />
              <Heading level={3}>Shipping Information</Heading>
            </Row>

            {/* Carrier/Tracking Info Box */}
            {order.carrier && (
              <View backgroundColor="$infoLight" borderRadius="$md" padding="$md">
                <Column gap="$sm">
                  <Text fontWeight="600" size="$5">
                    {order.carrier} {order.service && `- ${order.service}`}
                  </Text>
                  {order.trackingCode && (
                    <Row gap="$xs" alignItems="center" flexWrap="wrap">
                      <Text size="$4">Tracking:</Text>
                      {order.carrier ? (
                        <a
                          href={buildTrackingUrl(order.carrier, order.trackingCode)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "underline" }}
                        >
                          <Text size="$4" fontWeight="600" color="$primary">
                            {order.trackingCode}
                          </Text>
                        </a>
                      ) : (
                        <Text size="$4" fontWeight="600">
                          {order.trackingCode}
                        </Text>
                      )}
                    </Row>
                  )}
                  {order.estimatedDelivery && (
                    <Text size="$4">Estimated Delivery: {formatDate(order.estimatedDelivery)}</Text>
                  )}
                </Column>
              </View>
            )}

            {/* Rich Tracking Timeline */}
            {order.trackingCode && (
              <Column gap="$sm" marginTop="$lg">
                {/* Refresh button for active shipments */}
                {(order.shipmentStatus === "IN_TRANSIT" ||
                  order.shipmentStatus === "OUT_FOR_DELIVERY") && (
                  <Row alignItems="center" justifyContent="space-between">
                    <Text size="$4" color="$textSecondary">
                      Auto-refreshing every 15 seconds
                    </Text>
                    <Button
                      size="$3"
                      variant="outlined"
                      onPress={fetchTrackingEvents}
                      disabled={isLoadingTracking}
                      icon={
                        <RefreshCw
                          size={14}
                          color="var(--color-primary)"
                          style={
                            {
                              animation: isLoadingTracking ? "spin 1s linear infinite" : "none",
                            } as any
                          }
                        />
                      }
                    >
                      Refresh
                    </Button>
                  </Row>
                )}

                {trackingError && (
                  <Text size="$4" color="$error">
                    {trackingError}
                  </Text>
                )}

                <TrackingTimeline order={order} events={trackingEvents} />
              </Column>
            )}

            {/* Basic timeline fallback (no tracking code) */}
            {!order.trackingCode &&
              (order.labelGeneratedAt || order.shippedAt || order.deliveredAt) && (
                <Column gap="$md" marginTop="$sm">
                  {order.labelGeneratedAt && (
                    <TimelineItem label="Label Created" date={order.labelGeneratedAt} icon={Tag} />
                  )}
                  {order.shippedAt && (
                    <TimelineItem label="Package Shipped" date={order.shippedAt} icon={Truck} />
                  )}
                  {order.deliveredAt && (
                    <TimelineItem label="Delivered" date={order.deliveredAt} icon={CheckCircle} />
                  )}
                </Column>
              )}

            <Separator marginVertical="$sm" />

            {/* Addresses */}
            <Row gap="$lg" flexWrap="wrap">
              <AddressBlock title="From (Seller)" address={order.fromAddress} />
              <AddressBlock title="To (Buyer)" address={order.toAddress} />
            </Row>
          </Column>
        </Card>

        {/* Order Summary Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$md">
            <Heading level={3}>Order Summary</Heading>

            <Column gap="$sm">
              <Row justifyContent="space-between">
                <Text size="$5">Product Price</Text>
                <Text size="$5">£{order.product.price.toFixed(2)}</Text>
              </Row>
              <Row justifyContent="space-between">
                <Text size="$5">Shipping</Text>
                <Text size="$5">£{order.shippingCost.toFixed(2)}</Text>
              </Row>
              {order.buyerProtectionFee && order.buyerProtectionFee > 0 && (
                <Row justifyContent="space-between">
                  <Row gap="$xs" alignItems="center">
                    <Text size="$5">Buyer Protection</Text>
                    <Shield size={14} color="var(--color-textSecondary)" />
                  </Row>
                  <Text size="$5">£{order.buyerProtectionFee.toFixed(2)}</Text>
                </Row>
              )}
              <Separator marginVertical="$xs" />
              <Row justifyContent="space-between">
                <Text size="$6" fontWeight="700">
                  Total
                </Text>
                <Text size="$6" fontWeight="700" color="$primary">
                  £{order.amountTotal.toFixed(2)}
                </Text>
              </Row>
            </Column>

            {/* Seller Actions */}
            {order.userRole === "seller" && order.labelUrl && (
              <Column gap="$sm" marginTop="$md">
                <a
                  href={order.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <Button
                    size="$5"
                    backgroundColor="$success"
                    color="$textInverse"
                    width="100%"
                    paddingVertical="$md"
                    borderRadius="$md"
                    icon={<Download size={18} color="white" />}
                  >
                    Download Shipping Label
                  </Button>
                </a>
                <Text size="$4" color="$textSecondary" textAlign="center">
                  Print this label and attach it to your package. Drop it off at any {order.carrier}{" "}
                  location.
                </Text>
              </Column>
            )}

            {/* Buyer Tracking */}
            {order.userRole === "buyer" && order.trackingCode && order.carrier && (
              <a
                href={buildTrackingUrl(order.carrier, order.trackingCode)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", marginTop: 16 }}
              >
                <Button
                  butterVariant="primary"
                  size="$5"
                  width="100%"
                  icon={<ExternalLink size={18} color="white" />}
                >
                  Track Package
                </Button>
              </a>
            )}
          </Column>
        </Card>

        {/* Payment Status Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$md">
            <Row gap="$xs" alignItems="center">
              <DollarSign size={20} color="var(--color-text)" />
              <Heading level={3}>Payment Status</Heading>
            </Row>

            {/* Payment Hold Status Badge */}
            <Row gap="$md" alignItems="center" flexWrap="wrap">
              <Badge
                variant={
                  order.paymentHoldStatus === "RELEASED"
                    ? "success"
                    : order.paymentHoldStatus === "HELD"
                      ? "warning"
                      : order.paymentHoldStatus === "DISPUTED"
                        ? "error"
                        : "neutral"
                }
                size="lg"
              >
                {order.paymentHoldStatus === "HELD" && "🔒 Payment Held"}
                {order.paymentHoldStatus === "RELEASED" && "✓ Payment Released"}
                {order.paymentHoldStatus === "DISPUTED" && "⚠ Disputed"}
                {order.paymentHoldStatus === "REFUNDED" && "↩ Refunded"}
              </Badge>

              {order.paymentReleasedAt && (
                <Text size="$4" color="$textSecondary">
                  Released on {formatDateTime(order.paymentReleasedAt)}
                </Text>
              )}
            </Row>

            {/* Payment Hold Information - for buyers when HELD */}
            {order.userRole === "buyer" && order.paymentHoldStatus === "HELD" && (
              <Column gap="$md">
                <View
                  backgroundColor="$infoLight"
                  borderRadius="$md"
                  padding="$md"
                  borderLeftWidth={4}
                  borderLeftColor="$info"
                >
                  <Column gap="$sm">
                    <Text fontWeight="600" color="$info">
                      Your payment is protected
                    </Text>
                    <Text size="$4" color="$textSecondary">
                      Your money is held securely until you confirm you&apos;ve received your item.
                      If there&apos;s a problem, we&apos;ll help resolve it.
                    </Text>
                    {order.autoReleaseAt && (
                      <Row gap="$xs" alignItems="center">
                        <Clock size={14} color="var(--color-textSecondary)" />
                        <Text size="$3" color="$textMuted">
                          Auto-releases in {getDaysUntilAutoRelease()} days (
                          {new Date(order.autoReleaseAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                          )
                        </Text>
                      </Row>
                    )}
                  </Column>
                </View>

                {/* Confirm Receipt Button - only for DELIVERED orders */}
                {order.shipmentStatus === "DELIVERED" && (
                  <Column gap="$sm">
                    {confirmReceiptError && (
                      <View backgroundColor="$errorLight" borderRadius="$md" padding="$md">
                        <Text color="$error" size="$4">
                          {confirmReceiptError}
                        </Text>
                      </View>
                    )}

                    {confirmReceiptSuccess ? (
                      <View backgroundColor="$successLight" borderRadius="$md" padding="$md">
                        <Row gap="$sm" alignItems="center">
                          <CheckCircle size={20} color="var(--color-success)" />
                          <Column gap="$xs">
                            <Text fontWeight="600" color="$success">
                              Receipt Confirmed!
                            </Text>
                            <Text size="$4" color="$textSecondary">
                              Payment has been released to the seller.
                            </Text>
                          </Column>
                        </Row>
                      </View>
                    ) : (
                      <Button
                        butterVariant="primary"
                        size="$5"
                        width="100%"
                        onPress={handleConfirmReceipt}
                        disabled={isConfirmingReceipt}
                        icon={
                          isConfirmingReceipt ? undefined : <CheckCircle size={18} color="white" />
                        }
                      >
                        {isConfirmingReceipt
                          ? "Processing..."
                          : "Confirm Receipt & Release Payment"}
                      </Button>
                    )}

                    <Text size="$3" color="$textMuted" textAlign="center">
                      Only confirm once you&apos;ve received and inspected your item.
                    </Text>
                  </Column>
                )}

                {/* Waiting for delivery message */}
                {order.shipmentStatus !== "DELIVERED" && (
                  <View
                    backgroundColor="$background"
                    borderRadius="$md"
                    padding="$md"
                    borderWidth={1}
                    borderColor="$border"
                  >
                    <Row gap="$sm" alignItems="center">
                      <Package size={20} color="var(--color-textSecondary)" />
                      <Text size="$4" color="$textSecondary">
                        You can confirm receipt once your package is delivered.
                      </Text>
                    </Row>
                  </View>
                )}
              </Column>
            )}

            {/* Seller Payment Information */}
            {order.userRole === "seller" && (
              <Column gap="$sm">
                {order.paymentHoldStatus === "HELD" && (
                  <View
                    backgroundColor="$warningLight"
                    borderRadius="$md"
                    padding="$md"
                    borderLeftWidth={4}
                    borderLeftColor="$warning"
                  >
                    <Column gap="$sm">
                      <Text fontWeight="600" color="$warning">
                        Payment pending release
                      </Text>
                      <Text size="$4" color="$textSecondary">
                        Payment will be released when the buyer confirms receipt or automatically 14
                        days after delivery.
                      </Text>
                      {order.stripeSellerPayout && (
                        <Row gap="$xs" alignItems="center">
                          <DollarSign size={14} color="var(--color-success)" />
                          <Text size="$5" fontWeight="600" color="$success">
                            You&apos;ll receive: £{order.stripeSellerPayout.toFixed(2)}
                          </Text>
                        </Row>
                      )}
                      {order.autoReleaseAt && (
                        <Row gap="$xs" alignItems="center">
                          <Clock size={14} color="var(--color-textSecondary)" />
                          <Text size="$3" color="$textMuted">
                            Auto-releases:{" "}
                            {new Date(order.autoReleaseAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </Text>
                        </Row>
                      )}
                    </Column>
                  </View>
                )}

                {order.paymentHoldStatus === "RELEASED" && (
                  <View
                    backgroundColor="$successLight"
                    borderRadius="$md"
                    padding="$md"
                    borderLeftWidth={4}
                    borderLeftColor="$success"
                  >
                    <Column gap="$sm">
                      <Row gap="$sm" alignItems="center">
                        <CheckCircle size={20} color="var(--color-success)" />
                        <Text fontWeight="600" color="$success">
                          Payment released
                        </Text>
                      </Row>
                      {order.stripeSellerPayout && (
                        <Text size="$5" fontWeight="600">
                          £{order.stripeSellerPayout.toFixed(2)} transferred to your account
                        </Text>
                      )}
                      {order.buyerConfirmedAt && (
                        <Text size="$3" color="$textMuted">
                          Buyer confirmed receipt on {formatDateTime(order.buyerConfirmedAt)}
                        </Text>
                      )}
                    </Column>
                  </View>
                )}
              </Column>
            )}
          </Column>
        </Card>

        {/* Participants Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$md">
            <Heading level={3}>Order Participants</Heading>
            <Row gap="$lg" flexWrap="wrap">
              <ParticipantCard title="Seller" user={order.seller} />
              <ParticipantCard title="Buyer" user={order.buyer} />
            </Row>
          </Column>
        </Card>

        {/* Rating Section - shown after delivery for buyers */}
        <AnimationErrorBoundary
          fallback={
            <Card variant="outlined" padding="$lg">
              <Text color="$error">Unable to load rating section. Please refresh the page.</Text>
            </Card>
          }
        >
          <OrderRating
            orderId={order.id}
            isDelivered={order.shipmentStatus === "DELIVERED"}
            isBuyer={order.userRole === "buyer"}
            sellerName={`${order.seller.firstName || ""} ${order.seller.lastName || ""}`.trim()}
          />
        </AnimationErrorBoundary>

        {/* Messages Section */}
        <AnimationErrorBoundary
          fallback={
            <Card variant="outlined" padding="$lg">
              <Text color="$error">Unable to load messages. Please refresh the page.</Text>
            </Card>
          }
        >
          <OrderMessages
            orderId={order.id}
            currentUserId={order.currentUserId}
            otherUserName={
              order.userRole === "buyer"
                ? `${order.seller.firstName || ""} ${order.seller.lastName || ""}`.trim()
                : `${order.buyer.firstName || ""} ${order.buyer.lastName || ""}`.trim()
            }
            otherUserImage={
              order.userRole === "buyer" ? order.seller.imageUrl : order.buyer.imageUrl
            }
          />
        </AnimationErrorBoundary>
      </Column>
    </Container>
  );
}
