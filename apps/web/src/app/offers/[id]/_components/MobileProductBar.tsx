"use client";

import { useState } from "react";
import { Column, Row, Text, Badge, Image, Button, View } from "@buttergolf/ui";
import { X, ChevronDown } from "@tamagui/lucide-icons";

interface MobileProductBarProps {
  product: {
    id: string;
    title: string;
    price: number;
    condition: string;
    brand?: { name: string } | null;
    model: string | null;
    images: Array<{ id: string; url: string }>;
    user: {
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
  actionLoading?: boolean;
}

/**
 * Mobile product bar - sticky at top with expandable sheet for full details
 */
export function MobileProductBar({
  product,
  offer,
  currentUserId,
  onAccept,
  onReject,
  actionLoading = false,
}: MobileProductBarProps) {
  const [open, setOpen] = useState(false);

  const isUserSeller = currentUserId === offer.sellerId;
  const isOfferActive = ["PENDING", "COUNTERED"].includes(offer.status);
  const primaryImage = product.images[0]?.url || "/placeholder-product.png";

  const formatCondition = (condition: string) => {
    return condition.replaceAll("_", " ");
  };

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

  return (
    <>
      {/* Sticky bar */}
      <Row
        backgroundColor="$surface"
        padding="$md"
        gap="$sm"
        alignItems="center"
        borderBottomWidth={1}
        borderColor="$border"
        onPress={() => setOpen(true)}
        style={{
          position: "sticky",
          top: "80px", // Below header
          zIndex: 50,
          cursor: "pointer",
        }}
        hoverStyle={{
          backgroundColor: "$backgroundHover",
        }}
      >
        <Image
          src={primaryImage}
          width={60}
          height={60}
          borderRadius="$md"
          objectFit="cover"
          alt={product.title}
        />
        <Column gap="$xs" flex={1} minWidth={0}>
          <Text size="$4" fontWeight="600" numberOfLines={1} ellipsizeMode="tail">
            {product.title}
          </Text>
          <Row gap="$sm" alignItems="center">
            <Text size="$5" fontWeight="700" color="$primary">
              £{offer.amount.toFixed(2)}
            </Text>
            <Badge variant={getStatusBadgeVariant()} size="sm">
              <Text size="$3" fontWeight="600">
                {offer.status}
              </Text>
            </Badge>
          </Row>
        </Column>
        {/* Chevron down icon */}
        <ChevronDown size={24} color="$text" />
      </Row>

      {/* Expandable modal overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <View
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            backgroundColor="rgba(0,0,0,0.5)"
            zIndex={10000}
            onPress={() => setOpen(false)}
            style={{
              position: "fixed",
            }}
          />

          {/* Modal Content */}
          <Column
            backgroundColor="$surface"
            borderTopLeftRadius="$2xl"
            borderTopRightRadius="$2xl"
            padding="$lg"
            zIndex={10001}
            maxHeight="85vh"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              overflowY: "auto",
            }}
          >
            {/* Close button */}
            <Row justifyContent="flex-end" marginBottom="$md">
              <Button size="$4" chromeless onPress={() => setOpen(false)} padding="$2">
                <X size={24} color="$text" />
              </Button>
            </Row>
            <Column gap="$md" paddingTop="$md">
              {/* Product Image */}
              <Image
                src={primaryImage}
                width="100%"
                height={250}
                borderRadius="$lg"
                objectFit="cover"
                alt={product.title}
              />

              {/* Status */}
              <Badge variant={getStatusBadgeVariant()} size="md" alignSelf="flex-start">
                {offer.status}
              </Badge>

              {/* Title and Prices */}
              <Column gap="$sm">
                <Text size="$6" fontWeight="700" color="$text">
                  {product.title}
                </Text>
                <Row gap="$md">
                  <Column gap="$xs">
                    <Text size="$3" color="$textSecondary">
                      Listed Price
                    </Text>
                    <Text size="$5" fontWeight="600" color="$text">
                      £{product.price.toFixed(2)}
                    </Text>
                  </Column>
                  <Column gap="$xs">
                    <Text size="$3" color="$textSecondary">
                      Current Offer
                    </Text>
                    <Text size="$6" fontWeight="700" color="$primary">
                      £{offer.amount.toFixed(2)}
                    </Text>
                  </Column>
                </Row>
              </Column>

              {/* Divider */}
              <View height={1} backgroundColor="$border" width="100%" />

              {/* Seller */}
              <Column gap="$xs">
                <Text size="$4" fontWeight="600" color="$text">
                  Seller
                </Text>
                <Row gap="$xs" alignItems="center">
                  <Text size="$4" color="$textSecondary">
                    {`${product.user.firstName} ${product.user.lastName}`.trim() || "Unknown"}
                  </Text>
                  {product.user.ratingCount > 0 && (
                    <>
                      <Text color="$primary">★</Text>
                      <Text size="$4" fontWeight="600">
                        {product.user.averageRating.toFixed(1)}
                      </Text>
                      <Text size="$3" color="$textSecondary">
                        ({product.user.ratingCount})
                      </Text>
                    </>
                  )}
                </Row>
              </Column>

              {/* Divider */}
              <View height={1} backgroundColor="$border" width="100%" />

              {/* Specifications */}
              <Column gap="$sm">
                <Text size="$4" fontWeight="600" color="$text">
                  Details
                </Text>
                <Row justifyContent="space-between">
                  <Text size="$4" color="$textSecondary">
                    Brand:
                  </Text>
                  <Text size="$4" color="$text">
                    {product.brand?.name || "N/A"}
                  </Text>
                </Row>
                <Row justifyContent="space-between">
                  <Text size="$4" color="$textSecondary">
                    Model:
                  </Text>
                  <Text size="$4" color="$text">
                    {product.model || "N/A"}
                  </Text>
                </Row>
                <Row justifyContent="space-between">
                  <Text size="$4" color="$textSecondary">
                    Condition:
                  </Text>
                  <Text size="$4" color="$text">
                    {formatCondition(product.condition)}
                  </Text>
                </Row>
              </Column>

              {/* Action Buttons (seller only on mobile) */}
              {isOfferActive && isUserSeller && (
                <>
                  <View height={1} backgroundColor="$border" width="100%" />
                  <Column gap="$sm">
                    <Button
                      size="$5"
                      width="100%"
                      backgroundColor="$success"
                      color="$textInverse"
                      borderRadius="$full"
                      onPress={() => {
                        setOpen(false);
                        onAccept?.();
                      }}
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
                      onPress={() => {
                        setOpen(false);
                        onReject?.();
                      }}
                      disabled={actionLoading}
                    >
                      Reject Offer
                    </Button>
                  </Column>
                </>
              )}
            </Column>
          </Column>
        </>
      )}
    </>
  );
}
