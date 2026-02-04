"use client";

import { useEffect, useRef } from "react";
import { Column, Text, Spinner } from "@buttergolf/ui";
import { OfferMessage } from "./OfferMessage";

interface ConversationThreadProps {
  initialOffer: {
    id: string;
    amount: number;
    message?: string | null;
    createdAt: Date | string;
    buyer: { id: string; firstName: string; lastName: string };
    seller: { id: string; firstName: string; lastName: string };
  };
  counterOffers: Array<{
    id: string;
    amount: number;
    message?: string | null;
    fromSeller: boolean;
    createdAt: Date | string;
  }>;
  currentUserId: string;
  loading?: boolean;
}

/**
 * Conversation thread displaying all offers and counter-offers
 * Auto-scrolls to bottom on new messages
 */
export function ConversationThread({
  initialOffer,
  counterOffers,
  currentUserId,
  loading = false,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [counterOffers.length]);

  if (loading) {
    return (
      <Column alignItems="center" justifyContent="center" padding="$2xl" minHeight={400}>
        <Spinner size="lg" color="$primary" />
        <Text size="$4" color="$textSecondary" marginTop="$md">
          Loading conversation...
        </Text>
      </Column>
    );
  }

  const isCurrentUserSeller = currentUserId === initialOffer.seller.id;

  // Compute display names
  const buyerName =
    `${initialOffer.buyer.firstName} ${initialOffer.buyer.lastName}`.trim() || "Buyer";
  const sellerName =
    `${initialOffer.seller.firstName} ${initialOffer.seller.lastName}`.trim() || "Seller";

  return (
    <Column
      gap="$lg"
      padding="$lg"
      style={{
        maxHeight: "calc(100vh - 400px)",
        minHeight: 400,
        overflowY: "auto",
      }}
    >
      {/* Initial offer */}
      <OfferMessage
        amount={initialOffer.amount}
        message={initialOffer.message}
        createdAt={initialOffer.createdAt}
        fromSeller={false} // Initial offer is always from buyer
        isInitialOffer={true}
        senderName={buyerName}
      />

      {/* Counter-offers */}
      {counterOffers.map((counterOffer) => {
        const senderName = counterOffer.fromSeller ? sellerName : buyerName;

        return (
          <OfferMessage
            key={counterOffer.id}
            amount={counterOffer.amount}
            message={counterOffer.message}
            createdAt={counterOffer.createdAt}
            fromSeller={counterOffer.fromSeller}
            isInitialOffer={false}
            senderName={senderName}
          />
        );
      })}

      {/* Empty state */}
      {counterOffers.length === 0 && (
        <Column alignItems="center" padding="$2xl">
          <Text size="$5" color="$textSecondary" textAlign="center">
            {isCurrentUserSeller
              ? "No counter-offers yet. Accept, reject, or send a counter-offer below."
              : "Waiting for seller response..."}
          </Text>
        </Column>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </Column>
  );
}
