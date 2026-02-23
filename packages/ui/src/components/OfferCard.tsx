"use client";

import { View } from "tamagui";
import { Text } from "./Text";
import { Button } from "./Button";
import { Row, Column } from "./Layout";
import { Tag, ArrowRight, Check, X } from "@tamagui/lucide-icons";

type MessageType =
  | "OFFER"
  | "COUNTER_OFFER"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "OFFER_EXPIRED";
type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "COUNTERED";

interface OfferCardProps {
  /** Whether this card was sent by the current user */
  isOwnMessage: boolean;
  /** The type of offer message */
  type: MessageType;
  /** The offer amount in pounds */
  offerAmount?: number;
  /** Optional text content alongside the offer */
  content?: string;
  /** Formatted timestamp */
  timestamp: string;
  /** Current status of the offer — determines whether action buttons show */
  offerStatus?: OfferStatus;
  /** The offer ID — passed to action callbacks */
  offerId?: string;
  /** Accept callback */
  onAccept?: (offerId: string) => void;
  /** Reject callback */
  onReject?: (offerId: string) => void;
  /** Counter callback */
  onCounter?: (offerId: string) => void;
}

function getOfferLabel(type: MessageType, isOwnMessage: boolean): string {
  switch (type) {
    case "OFFER":
      return isOwnMessage ? "You made an offer" : "Made an offer";
    case "COUNTER_OFFER":
      return isOwnMessage ? "You countered" : "Counter-offer";
    case "OFFER_ACCEPTED":
      return "Offer accepted";
    case "OFFER_REJECTED":
      return "Offer declined";
    case "OFFER_EXPIRED":
      return "Offer expired";
  }
}

function getStatusColor(type: MessageType): string {
  switch (type) {
    case "OFFER":
    case "COUNTER_OFFER":
      return "$primary";
    case "OFFER_ACCEPTED":
      return "$success";
    case "OFFER_REJECTED":
      return "$error";
    case "OFFER_EXPIRED":
      return "$textTertiary";
  }
}

function getStatusIcon(type: MessageType) {
  switch (type) {
    case "OFFER":
      return <Tag size={16} color="$primary" />;
    case "COUNTER_OFFER":
      return <ArrowRight size={16} color="$primary" />;
    case "OFFER_ACCEPTED":
      return <Check size={16} color="$success" />;
    case "OFFER_REJECTED":
      return <X size={16} color="$error" />;
    case "OFFER_EXPIRED":
      return <Tag size={16} color="$textTertiary" />;
  }
}

/** Whether this offer card should show accept/reject/counter buttons */
function canActOnOffer(
  type: MessageType,
  offerStatus: OfferStatus | undefined,
  isOwnMessage: boolean
): boolean {
  // Only show action buttons on OFFER/COUNTER_OFFER messages
  if (type !== "OFFER" && type !== "COUNTER_OFFER") return false;
  // Only show on active offers
  if (offerStatus !== "PENDING" && offerStatus !== "COUNTERED") return false;
  // Only the OTHER party can act (not the person who sent the offer/counter)
  return !isOwnMessage;
}

export function OfferCard({
  isOwnMessage,
  type,
  offerAmount,
  content,
  timestamp,
  offerStatus,
  offerId,
  onAccept,
  onReject,
  onCounter,
}: Readonly<OfferCardProps>) {
  const statusColor = getStatusColor(type);
  const showActions = canActOnOffer(type, offerStatus, isOwnMessage);

  return (
    <Row
      justifyContent={isOwnMessage ? "flex-end" : "flex-start"}
      paddingHorizontal="$sm"
      marginTop="$sm"
    >
      <Column
        maxWidth="80%"
        minWidth={220}
        backgroundColor="$surface"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        overflow="hidden"
      >
        {/* Header stripe */}
        <View height={3} backgroundColor={statusColor} />

        <Column padding="$md" gap="$sm">
          {/* Label row */}
          <Row alignItems="center" gap="$xs">
            {getStatusIcon(type)}
            <Text size="$3" color="$textSecondary" weight="medium">
              {getOfferLabel(type, isOwnMessage)}
            </Text>
          </Row>

          {/* Amount */}
          {offerAmount != null && (
            <Text size="$8" weight="bold" color={statusColor}>
              £{offerAmount.toFixed(2)}
            </Text>
          )}

          {/* Optional message text */}
          {content && content.trim() !== "" && (
            <Text size="$4" color="$text">
              {content}
            </Text>
          )}

          {/* Action buttons — only shown on the recipient's side, for active offers */}
          {showActions && offerId && (
            <Row gap="$sm" marginTop="$xs" flexWrap="wrap">
              {onAccept && (
                <Button
                  size="$3"
                  backgroundColor="$success"
                  color="$textInverse"
                  borderRadius="$md"
                  onPress={() => onAccept(offerId)}
                  flex={1}
                  minWidth={80}
                >
                  Accept
                </Button>
              )}
              {onCounter && (
                <Button
                  size="$3"
                  backgroundColor="$primary"
                  color="$textInverse"
                  borderRadius="$md"
                  onPress={() => onCounter(offerId)}
                  flex={1}
                  minWidth={80}
                >
                  Counter
                </Button>
              )}
              {onReject && (
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  color="$error"
                  borderWidth={1}
                  borderColor="$error"
                  borderRadius="$md"
                  onPress={() => onReject(offerId)}
                  flex={1}
                  minWidth={80}
                >
                  Decline
                </Button>
              )}
            </Row>
          )}

          {/* Timestamp */}
          <Text size="$1" color="$textTertiary" textAlign="right">
            {timestamp}
          </Text>
        </Column>
      </Column>
    </Row>
  );
}

export type { OfferCardProps };
