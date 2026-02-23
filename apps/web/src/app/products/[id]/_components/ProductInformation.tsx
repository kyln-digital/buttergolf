"use client";

import { useState } from "react";
import { Column, Row, Text, Button, Heading, Popover, Input } from "@buttergolf/ui";
import { Button as TamaguiButton } from "tamagui";
import { Heart, Info } from "@tamagui/lucide-icons";
import type { Product } from "../ProductDetailClient";

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  averageRating?: number | null;
  ratingCount?: number;
}

interface ProductInformationProps {
  product: Product;
  onBuyNow: () => void;
  onSubmitOffer: (amount: number) => Promise<void>;
}

export function ProductInformation({ product, onBuyNow, onSubmitOffer }: ProductInformationProps) {
  const [isFavourite, setIsFavourite] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerError, setOfferError] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  const handleSubmitOffer = async () => {
    const amount = Number.parseFloat(offerAmount);

    if (!offerAmount || Number.isNaN(amount) || amount <= 0) {
      setOfferError("Please enter a valid amount");
      return;
    }

    if (amount >= product.price) {
      setOfferError(`Must be less than £${product.price.toFixed(2)}`);
      return;
    }

    setOfferError("");
    setSubmittingOffer(true);

    try {
      await onSubmitOffer(amount);
      setOfferAmount("");
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : "Failed to submit. Try again.");
    } finally {
      setSubmittingOffer(false);
    }
  };

  const formatCondition = (condition: string) => {
    return condition.replace(/_/g, " ");
  };

  const averageRating = product.user.averageRating || 0;
  const ratingCount = product.user.ratingCount || 0;

  return (
    <Column
      backgroundColor="$surface"
      borderRadius="$xl"
      padding="$lg"
      gap="$md"
      width="100%"
      $gtMd={{
        width: 420,
        flexShrink: 0,
      }}
    >
      {/* Header: Title, Price, Favourite */}
      <Row justifyContent="space-between" alignItems="flex-start" gap="$sm">
        <Column gap="$xs" flex={1}>
          <Heading level={2} size="$7" color="$text">
            {product.title}
          </Heading>
          <Row alignItems="baseline" gap="$sm">
            <Text size="$7" fontWeight="700" color="$primary">
              £{product.price.toFixed(2)}
            </Text>
            <Column
              width={16}
              height={16}
              borderRadius="$full"
              borderWidth={2}
              borderColor="$textSecondary"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              title="Price information"
            >
              <Info size={10} color="$textSecondary" />
            </Column>
          </Row>
        </Column>
        <Button
          butterVariant="icon"
          circular
          width={44}
          height={44}
          padding={0}
          borderColor={isFavourite ? "$primary" : "$border"}
          backgroundColor={isFavourite ? "$primaryLight" : "transparent"}
          onPress={() => setIsFavourite(!isFavourite)}
          animation="quick"
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          <Heart
            size={22}
            fill={isFavourite ? "$primary" : "transparent"}
            color={isFavourite ? "$primary" : "$textSecondary"}
            opacity={isFavourite ? 1 : 0.9}
            strokeWidth={1.5}
          />
        </Button>
      </Row>

      {/* Divider */}
      <Column height={1} backgroundColor="$border" width="100%" />

      {/* Seller Info */}
      <Column gap="$sm">
        <Row justifyContent="space-between" alignItems="center">
          <Column gap="$xs" flex={1}>
            <Text size="$3" color="$textSecondary" weight="bold">
              Posted by {`${product.user.firstName} ${product.user.lastName}`.trim() || "Unknown"}
            </Text>
            <Text size="$2" color="$textSecondary">
              Member for 3 years
            </Text>
            {ratingCount > 0 && (
              <Row gap="$xs" alignItems="center">
                <Text size="$3" color="$primary">
                  ★
                </Text>
                <Text size="$3" color="$text" weight="semibold">
                  {averageRating.toFixed(1)}
                </Text>
                <Text size="$2" color="$textSecondary">
                  ({ratingCount})
                </Text>
              </Row>
            )}
          </Column>
          <Button butterVariant="primary" size="$4" borderRadius="$full" paddingHorizontal="$5">
            View profile
          </Button>
        </Row>
      </Column>

      {/* Divider */}
      <Column height={1} backgroundColor="$border" width="100%" />

      {/* Product Specifications */}
      <Row gap="$md">
        <Column gap="$sm" flex={1}>
          <Text size="$3" color="$text" weight="bold" lineHeight="$3">
            Category
          </Text>
          <Text size="$3" color="$text" weight="bold" lineHeight="$3">
            Brand
          </Text>
          <Text size="$3" color="$text" weight="bold" lineHeight="$3">
            Product
          </Text>
          <Text size="$3" color="$text" weight="bold" lineHeight="$3">
            Product
          </Text>
          <Text size="$3" color="$text" weight="bold" lineHeight="$3">
            Condition
          </Text>
        </Column>
        <Column gap="$sm" flex={1}>
          <Text size="$3" color="$text" lineHeight="$3">
            {product.category.name}
          </Text>
          <Text size="$3" color="$text" lineHeight="$3">
            {product.brand || "N/A"}
          </Text>
          <Text size="$3" color="$text" lineHeight="$3">
            {product.model || "N/A"}
          </Text>
          <Text size="$3" color="$text" lineHeight="$3">
            {product.model || "N/A"}
          </Text>
          <Text size="$3" color="$text" lineHeight="$3">
            {formatCondition(product.condition)}
          </Text>
        </Column>
      </Row>

      {/* Divider */}
      <Column height={1} backgroundColor="$border" width="100%" />

      {/* Product Description */}
      <Column gap="$md">
        <Text size="$3" color="$text" weight="bold">
          Product Description
        </Text>
        <Text size="$3" color="$text">
          {product.description}
        </Text>
      </Column>

      {/* Divider */}
      <Column height={1} backgroundColor="$border" width="100%" />

      {/* CTA Buttons */}
      <Column gap="$md" width="100%">
        <Button
          butterVariant="primary"
          size="$5"
          width="100%"
          borderRadius="$full"
          height={56}
          disabled={product.isSold}
          onPress={onBuyNow}
        >
          {product.isSold ? "Sold Out" : "Buy now"}
        </Button>

        {/* Make an Offer Popover */}
        <Popover
          placement="bottom"
          onOpenChange={(open) => {
            if (!open) {
              setOfferAmount("");
              setOfferError("");
            }
          }}
        >
          <Popover.Trigger asChild>
            <TamaguiButton
              size="$5"
              width="100%"
              height={56}
              backgroundColor="$cloudMist"
              borderWidth={1}
              borderColor="$border"
              color="$text"
              borderRadius="$full"
              fontFamily="$body"
              fontWeight="700"
              cursor="pointer"
              boxShadow="0px 1px 4px rgba(0, 0, 0, 0.2)"
              disabled={product.isSold}
              hoverStyle={{ backgroundColor: "$cloudMistHover", borderColor: "$borderHover" }}
              pressStyle={{ backgroundColor: "$cloudMistPress", scale: 0.98 }}
            >
              Make an offer
            </TamaguiButton>
          </Popover.Trigger>

          <Popover.Content
            backgroundColor="$surface"
            borderRadius="$lg"
            padding="$4"
            borderWidth={1}
            borderColor="$border"
            elevate
          >
            <Column gap="$3" width={280}>
              <Text size="$5" fontWeight="600" color="$text">
                Make an offer
              </Text>

              {/* Price Input */}
              <Row
                alignItems="center"
                borderWidth={1}
                borderColor={offerError ? "$error" : "$border"}
                borderRadius="$md"
                backgroundColor="$surface"
                overflow="hidden"
                focusWithinStyle={{ borderColor: "$primary", borderWidth: 2 }}
              >
                <Text
                  paddingLeft="$sm"
                  paddingRight="$xs"
                  color="$text"
                  fontWeight="500"
                  userSelect="none"
                >
                  £
                </Text>
                <Input
                  keyboardType="decimal-pad"
                  placeholder="Your offer"
                  value={offerAmount}
                  onChangeText={(text) => {
                    const sanitised = text.replace(/[^0-9.]/g, "").replace(/(\..*?)\./g, "$1");
                    setOfferAmount(sanitised);
                    setOfferError("");
                  }}
                  disabled={submittingOffer}
                  autoFocus
                  flex={1}
                  borderWidth={0}
                  backgroundColor="transparent"
                  onSubmitEditing={!submittingOffer ? handleSubmitOffer : undefined}
                />
              </Row>

              {offerError && (
                <Text size="$2" color="$error">
                  {offerError}
                </Text>
              )}

              <Row gap="$2" justifyContent="flex-end">
                <Popover.Close asChild>
                  <TamaguiButton
                    size="$3"
                    backgroundColor="transparent"
                    color="$textSecondary"
                    borderRadius="$full"
                    paddingHorizontal="$3"
                  >
                    Cancel
                  </TamaguiButton>
                </Popover.Close>
                <Button
                  butterVariant="primary"
                  size="$3"
                  onPress={handleSubmitOffer}
                  disabled={submittingOffer || !offerAmount}
                >
                  {submittingOffer ? "Submitting..." : "Submit"}
                </Button>
              </Row>
            </Column>
          </Popover.Content>
        </Popover>
      </Column>
    </Column>
  );
}
