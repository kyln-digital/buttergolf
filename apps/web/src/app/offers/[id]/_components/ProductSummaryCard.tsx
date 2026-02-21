"use client";

import { useState } from "react";
import { Column, Row, Text, Button, Heading, Badge, Image, View } from "@buttergolf/ui";
import { useRouter } from "next/navigation";

interface ProductSummaryCardProps {
  product: {
    id: string;
    title: string;
    price: number;
    condition: string;
    brand?: { name: string } | null;
    model: string | null;
    images: Array<{ id: string; url: string; alt?: string | null }>;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      averageRating: number | null;
      ratingCount: number;
    };
  };
  offer: {
    id: string;
    status: string;
    amount: number;
    buyerId: string;
    sellerId: string;
  };
  currentUserId: string;
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  actionLoading?: boolean;
}

/**
 * Product summary sidebar for offers page
 * Shows product details and offer action buttons based on user role and offer status
 */
export function ProductSummaryCard({
  product,
  offer,
  currentUserId,
  onAccept,
  onReject,
  onCounter,
  actionLoading = false,
}: ProductSummaryCardProps) {
  const router = useRouter();
  const [localLoading, setLocalLoading] = useState(false);

  const isUserSeller = currentUserId === offer.sellerId;
  const isOfferActive = ["PENDING", "COUNTERED"].includes(offer.status);
  const isOfferAccepted = offer.status === "ACCEPTED";
  const isOfferExpired = offer.status === "EXPIRED";
  const isOfferRejected = offer.status === "REJECTED";

  const formatCondition = (condition: string) => {
    return condition.replaceAll("_", " ");
  };

  const primaryImage = product.images[0]?.url || "/placeholder-product.png";
  const averageRating = product.user.averageRating || 0;
  const ratingCount = product.user.ratingCount || 0;

  const getStatusBadgeVariant = () => {
    switch (offer.status) {
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

  const handleProceedToCheckout = () => {
    setLocalLoading(true);
    router.push(`/checkout/${product.id}?offerId=${offer.id}`);
  };

  return (
    <Column
      backgroundColor="$cloudMist"
      borderRadius="$xl"
      padding="$lg"
      gap="$md"
      width="100%"
      style={{
        position: "sticky",
        top: "100px",
      }}
    >
      {/* Product Image */}
      <Image
        source={{ uri: primaryImage }}
        width="100%"
        height={300}
        borderRadius="$lg"
        resizeMode="cover"
        alt={product.title}
      />

      {/* Status Badge */}
      <Badge variant={getStatusBadgeVariant()} size="md">
        <Text size="$4" fontWeight="600">
          {offer.status}
        </Text>
      </Badge>

      {/* Title and Current Offer */}
      <Column gap="$xs">
        <Heading level={3} size="$6" color="$ironstone">
          {product.title}
        </Heading>
        <Row alignItems="baseline" gap="$sm">
          <Text size="$4" color="$textSecondary">
            Listed:
          </Text>
          <Text size="$5" fontWeight="600" color="$ironstone">
            £{product.price.toFixed(2)}
          </Text>
        </Row>
        <Row alignItems="baseline" gap="$sm">
          <Text size="$4" color="$textSecondary">
            Current Offer:
          </Text>
          <Text size="$6" fontWeight="700" color="$spicedClementine">
            £{offer.amount.toFixed(2)}
          </Text>
        </Row>
      </Column>

      {/* Divider */}
      <View height={1} backgroundColor="$border" width="100%" />

      {/* Seller Info */}
      <Column gap="$sm">
        <Text size="$3" color="$slateSmoke" weight="bold">
          {isUserSeller
            ? "Your listing"
            : `Seller: ${`${product.user.firstName} ${product.user.lastName}`.trim() || "Unknown"}`}
        </Text>
        {ratingCount > 0 && (
          <Row gap="$xs" alignItems="center">
            <Text color="$primary" size="$4">
              ★
            </Text>
            <Text size="$3" color="$ironstone" weight="semibold">
              {averageRating.toFixed(1)}
            </Text>
            <Text size="$2" color="$slateSmoke">
              ({ratingCount} ratings)
            </Text>
          </Row>
        )}
      </Column>

      {/* Divider */}
      <View height={1} backgroundColor="$border" width="100%" />

      {/* Product Specifications */}
      <Row gap="$md">
        <Column gap="$sm" flex={1}>
          <Text size="$3" color="$ironstone" weight="bold">
            Brand
          </Text>
          <Text size="$3" color="$ironstone" weight="bold">
            Model
          </Text>
          <Text size="$3" color="$ironstone" weight="bold">
            Condition
          </Text>
        </Column>
        <Column gap="$sm" flex={1}>
          <Text size="$3" color="$ironstone">
            {product.brand?.name || "N/A"}
          </Text>
          <Text size="$3" color="$ironstone">
            {product.model || "N/A"}
          </Text>
          <Text size="$3" color="$ironstone">
            {formatCondition(product.condition)}
          </Text>
        </Column>
      </Row>

      {/* Divider */}
      <View height={1} backgroundColor="$border" width="100%" />

      {/* Action Buttons */}
      <Column gap="$sm">
        {isOfferAccepted && !isUserSeller && (
          <Button
            size="$5"
            width="100%"
            backgroundColor="$success"
            color="$textInverse"
            borderRadius="$full"
            onPress={handleProceedToCheckout}
            disabled={localLoading}
          >
            {localLoading ? "Loading..." : "Proceed to Checkout"}
          </Button>
        )}

        {isOfferActive && isUserSeller && (
          <>
            <Button
              size="$5"
              width="100%"
              backgroundColor="$success"
              color="$textInverse"
              borderRadius="$full"
              onPress={onAccept}
              disabled={actionLoading}
            >
              Accept Offer
            </Button>
            <Button
              size="$5"
              width="100%"
              backgroundColor="$error"
              color="$textInverse"
              borderRadius="$full"
              onPress={onReject}
              disabled={actionLoading}
            >
              Reject Offer
            </Button>
          </>
        )}

        {(isOfferExpired || isOfferRejected) && (
          <Column alignItems="center" padding="$md">
            <Text size="$4" color="$textSecondary" textAlign="center">
              {isOfferExpired ? "This offer has expired" : "This offer was rejected"}
            </Text>
          </Column>
        )}
      </Column>
    </Column>
  );
}
