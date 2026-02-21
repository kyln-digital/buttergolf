"use client";

import { useState } from "react";
import { Column, Row, Text, Badge, Card, Image, Button } from "@buttergolf/ui";
import { useRouter, usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

interface OffersSidebarProps {
  offers: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    buyerId: string;
    sellerId: string;
    product: {
      id: string;
      title: string;
      images: Array<{ id: string; url: string }>;
    };
    counterOffers: Array<{
      amount: number;
      createdAt: Date | string;
    }>;
  }>;
  currentUserId: string;
}

/**
 * Sidebar navigation for offers
 * Shows Buying/Selling toggle and list of conversations
 */
export function OffersSidebar({ offers, currentUserId }: OffersSidebarProps) {
  const [activeTab, setActiveTab] = useState<"buying" | "selling">("buying");
  const router = useRouter();
  const pathname = usePathname();

  const currentOfferId = pathname.split("/").pop();

  // Filter offers based on active tab
  const filteredOffers = offers.filter((offer) =>
    activeTab === "buying" ? offer.buyerId === currentUserId : offer.sellerId === currentUserId
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "success";
      case "REJECTED":
        return "error";
      case "EXPIRED":
        return "neutral";
      case "COUNTERED":
        return "warning";
      default:
        return "info";
    }
  };

  const getLatestAmount = (offer: (typeof offers)[0]) => {
    if (offer.counterOffers.length > 0) {
      return offer.counterOffers[offer.counterOffers.length - 1].amount;
    }
    return offer.amount;
  };

  const getLatestTimestamp = (offer: (typeof offers)[0]) => {
    if (offer.counterOffers.length > 0) {
      return offer.counterOffers[offer.counterOffers.length - 1].createdAt;
    }
    return offer.updatedAt;
  };

  return (
    <Column
      width="100%"
      $gtLg={{
        width: "20%",
        minWidth: 250,
        maxWidth: 300,
      }}
      gap="$md"
      style={{
        position: "sticky",
        top: "100px",
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
      }}
    >
      {/* Buying / Selling Toggle */}
      <Row gap="$xs" width="100%">
        <Button
          flex={1}
          borderRadius="$full"
          backgroundColor={activeTab === "buying" ? "$primary" : "transparent"}
          color={activeTab === "buying" ? "$textInverse" : "$text"}
          fontWeight="600"
          size="$4"
          onPress={() => setActiveTab("buying")}
          animation="quick"
        >
          Buying
        </Button>
        <Button
          flex={1}
          borderRadius="$full"
          backgroundColor={activeTab === "selling" ? "$primary" : "transparent"}
          color={activeTab === "selling" ? "$textInverse" : "$text"}
          fontWeight="600"
          size="$4"
          onPress={() => setActiveTab("selling")}
          animation="quick"
        >
          Selling
        </Button>
      </Row>

      {/* Offers List */}
      <Column gap="$sm">
        {filteredOffers.length === 0 ? (
          <Card variant="outlined" padding="$md">
            <Text size="$4" color="$textSecondary" textAlign="center">
              No {activeTab} offers yet
            </Text>
          </Card>
        ) : (
          filteredOffers.map((offer) => {
            const isActive = offer.id === currentOfferId;
            const latestAmount = getLatestAmount(offer);
            const latestTimestamp = getLatestTimestamp(offer);
            const date =
              typeof latestTimestamp === "string" ? new Date(latestTimestamp) : latestTimestamp;

            return (
              <Card
                key={offer.id}
                variant={isActive ? "filled" : "outlined"}
                padding="$sm"
                onPress={() => router.push(`/offers/${offer.id}`)}
                style={{
                  cursor: "pointer",
                }}
                backgroundColor={isActive ? "$primaryLight" : undefined}
                borderWidth={isActive ? 2 : 1}
                borderColor={isActive ? "$primary" : "$border"}
                hoverStyle={{
                  backgroundColor: isActive ? "$primaryLight" : "$surface",
                }}
              >
                <Row gap="$sm" alignItems="flex-start">
                  {/* Product thumbnail */}
                  <Image
                    source={{ uri: offer.product.images[0]?.url }}
                    width={50}
                    height={50}
                    borderRadius="$md"
                    resizeMode="cover"
                    alt={offer.product.title}
                  />

                  {/* Offer details */}
                  <Column gap="$xs" flex={1} minWidth={0}>
                    <Text
                      size="$3"
                      fontWeight="600"
                      color="$text"
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {offer.product.title}
                    </Text>
                    <Text size="$4" fontWeight="700" color="$primary">
                      £{latestAmount.toFixed(2)}
                    </Text>
                    <Row justifyContent="space-between" alignItems="center">
                      <Badge variant={getStatusBadgeVariant(offer.status)} size="sm">
                        {offer.status}
                      </Badge>
                      <Text size="$2" color="$textSecondary">
                        {formatDistanceToNow(date, { addSuffix: true })}
                      </Text>
                    </Row>
                  </Column>
                </Row>
              </Card>
            );
          })
        )}
      </Column>
    </Column>
  );
}
