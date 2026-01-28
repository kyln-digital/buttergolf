"use client";

import { Card, Column, Row, Text, Badge } from "@buttergolf/ui";
import { formatDistanceToNow } from "date-fns";

export interface OfferMessageProps {
  amount: number;
  message?: string | null;
  createdAt: Date | string;
  fromSeller: boolean;
  isInitialOffer?: boolean;
  senderName: string;
}

/**
 * Message bubble component for offer conversation
 * Displays offer/counter-offer with amount, optional message, and timestamp
 * Styled differently based on sender (buyer vs seller)
 */
export function OfferMessage({
  amount,
  message,
  createdAt,
  fromSeller,
  isInitialOffer = false,
  senderName,
}: OfferMessageProps) {
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;

  return (
    <Row justifyContent={fromSeller ? "flex-end" : "flex-start"} width="100%">
      <Card
        variant="filled"
        padding="$md"
        maxWidth="75%"
        backgroundColor={fromSeller ? "$primary" : "$surface"}
        borderWidth={fromSeller ? 0 : 1}
        borderColor="$border"
      >
        <Column gap="$sm">
          {/* Sender name and badge */}
          <Row justifyContent="space-between" alignItems="center" gap="$sm">
            <Text size="$3" fontWeight="600" color={fromSeller ? "$textInverse" : "$textSecondary"}>
              {senderName}
            </Text>
            {isInitialOffer ? (
              <Badge variant="info" size="sm">
                <Text size="$3" fontWeight="600">
                  Initial Offer
                </Text>
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">
                <Text size="$3" fontWeight="600">
                  Counter
                </Text>
              </Badge>
            )}
          </Row>

          {/* Offer amount */}
          <Text size="$7" fontWeight="700" color={fromSeller ? "$textInverse" : "$text"}>
            £{amount.toFixed(2)}
          </Text>

          {/* Optional message */}
          {message && (
            <Text
              size="$4"
              color={fromSeller ? "$textInverse" : "$text"}
              style={{ whiteSpace: "pre-wrap" }}
            >
              {message}
            </Text>
          )}

          {/* Timestamp */}
          <Text
            size="$3"
            color={fromSeller ? "$textInverse" : "$textSecondary"}
            style={{ opacity: 0.7 }}
          >
            {formatDistanceToNow(date, { addSuffix: true })}
          </Text>
        </Column>
      </Card>
    </Row>
  );
}
