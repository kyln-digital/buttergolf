"use client";

import { Column, Row, Text, View, Badge } from "@buttergolf/ui";
import { Package, Truck, MapPin, CheckCircle } from "@tamagui/lucide-icons";
import type { ShipmentStatus } from "@buttergolf/db";

interface OrderTracking {
  trackingCode: string | null;
  carrier: string | null;
  service: string | null;
  estimatedDelivery: Date | null;
  shipmentStatus: ShipmentStatus;
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

interface TrackingTimelineProps {
  order: OrderTracking;
  events: TrackingEvent[];
}

/**
 * Visual timeline showing package tracking events
 *
 * Displays a vertical timeline with completed and pending events,
 * carrier information, and estimated delivery date.
 */
export function TrackingTimeline({ order, events }: TrackingTimelineProps) {
  const { trackingCode, carrier, service, estimatedDelivery, shipmentStatus } = order;

  // Map shipment status to timeline stages
  const stages = [
    {
      key: "LABEL_CREATED",
      label: "Label Created",
      icon: Package,
      completed: ["PRE_TRANSIT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
        shipmentStatus
      ),
    },
    {
      key: "IN_TRANSIT",
      label: "In Transit",
      icon: Truck,
      completed: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(shipmentStatus),
    },
    {
      key: "OUT_FOR_DELIVERY",
      label: "Out for Delivery",
      icon: MapPin,
      completed: ["OUT_FOR_DELIVERY", "DELIVERED"].includes(shipmentStatus),
    },
    {
      key: "DELIVERED",
      label: "Delivered",
      icon: CheckCircle,
      completed: shipmentStatus === "DELIVERED",
    },
  ];

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Column gap="$lg" width="100%">
      {/* Tracking Header */}
      <Column gap="$sm" padding="$md" backgroundColor="$surface" borderRadius="$md">
        <Row alignItems="center" justifyContent="space-between">
          <Column gap="$xs">
            <Text size="$3" color="$textSecondary">
              Tracking Number
            </Text>
            <Text size="$5" weight="semibold" color="$text">
              {trackingCode || "Not available"}
            </Text>
          </Column>

          {carrier && (
            <Badge variant="outline">
              {carrier} {service ? `- ${service}` : ""}
            </Badge>
          )}
        </Row>

        {estimatedDelivery && (
          <Row alignItems="center" gap="$sm" marginTop="$sm">
            <CheckCircle size={16} color="$success" />
            <Text size="$4" color="$textSecondary">
              Est. Delivery:{" "}
              <Text weight="semibold" color="$text">
                {formatDate(estimatedDelivery.toString())}
              </Text>
            </Text>
          </Row>
        )}
      </Column>

      {/* Timeline Stages */}
      <Column gap="$md">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = stage.completed;
          const isLast = index === stages.length - 1;

          return (
            <Row key={stage.key} gap="$md" alignItems="flex-start">
              {/* Timeline indicator */}
              <Column alignItems="center" gap="$xs">
                <View
                  backgroundColor={isCompleted ? "$success" : "$border"}
                  borderRadius="$full"
                  padding="$2"
                >
                  <Icon size={20} color={isCompleted ? "white" : "$textMuted"} />
                </View>
                {!isLast && (
                  <View
                    width={2}
                    height={40}
                    backgroundColor={isCompleted ? "$success" : "$border"}
                  />
                )}
              </Column>

              {/* Stage label */}
              <Column gap="$xs" flex={1}>
                <Text
                  size="$5"
                  weight={isCompleted ? "semibold" : "normal"}
                  color={isCompleted ? "$text" : "$textSecondary"}
                >
                  {stage.label}
                </Text>
                {stage.key === shipmentStatus && (
                  <Text size="$3" color="$textSecondary">
                    Current status
                  </Text>
                )}
              </Column>
            </Row>
          );
        })}
      </Column>

      {/* Detailed Events */}
      {events.length > 0 && (
        <Column gap="$md" marginTop="$lg">
          <Text size="$6" weight="semibold" color="$text">
            Tracking History
          </Text>

          <Column gap="$sm">
            {events.map((event, index) => (
              <Column
                key={index}
                gap="$xs"
                padding="$md"
                backgroundColor="$surface"
                borderRadius="$md"
                borderLeftWidth={3}
                borderLeftColor="$primary"
              >
                <Text size="$4" weight="semibold" color="$text">
                  {event.description}
                </Text>

                {(event.city_locality || event.state_province) && (
                  <Row alignItems="center" gap="$xs">
                    <MapPin size={14} color="$textSecondary" />
                    <Text size="$3" color="$textSecondary">
                      {[event.city_locality, event.state_province, event.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </Text>
                  </Row>
                )}

                <Text size="$3" color="$textMuted">
                  {formatDate(event.occurred_at)}
                </Text>

                {event.signer && (
                  <Text size="$3" color="$textSecondary">
                    Signed by: {event.signer}
                  </Text>
                )}
              </Column>
            ))}
          </Column>
        </Column>
      )}

      {/* No tracking events yet */}
      {events.length === 0 && shipmentStatus === "PRE_TRANSIT" && (
        <Column gap="$sm" padding="$md" backgroundColor="$surface" borderRadius="$md">
          <Text size="$4" color="$textSecondary" textAlign="center">
            Package hasn&apos;t been scanned by carrier yet. Check back soon!
          </Text>
        </Column>
      )}
    </Column>
  );
}
