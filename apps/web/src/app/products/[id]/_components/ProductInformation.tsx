"use client";

import { useState } from "react";
import { useTheme } from "tamagui";
import { Column, Row, Text, Button, Heading, Popover } from "@buttergolf/ui";
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const theme = useTheme();

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
      setPopoverOpen(false);
      setOfferAmount("");
    } catch {
      setOfferError("Failed to submit. Try again.");
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
        <View
          width={44}
          height={44}
          borderRadius="$full"
          borderWidth={1.5}
          borderColor={isFavourite ? "$primary" : "$border"}
          backgroundColor={isFavourite ? "$primaryLight" : "transparent"}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          onPress={() => setIsFavourite(!isFavourite)}
          hoverStyle={{
            borderColor: "$primary",
            backgroundColor: "$primaryLight",
          }}
          pressStyle={{ scale: 0.95, opacity: 0.85 }}
          animation="quick"
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
          role="button"
        >
          <Heart
            size={22}
            fill={isFavourite ? theme.primary.val : "none"}
            color={isFavourite ? "$primary" : "$textSecondary"}
            strokeWidth={1.5}
          />
        </View>
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
          placement="top"
          open={popoverOpen}
          onOpenChange={(open) => {
            setPopoverOpen(open);
            if (!open) {
              setOfferAmount("");
              setOfferError("");
            }
          }}
        >
          <Popover.Trigger asChild>
            <Button
              butterVariant="secondary"
              size="$5"
              width="100%"
              height={56}
              disabled={product.isSold}
            >
              Make an offer
            </Button>
          </Popover.Trigger>
          <Popover.Content
            backgroundColor="$surface"
            borderRadius="$lg"
            padding="$4"
            borderWidth={1}
            borderColor="$border"
            shadowColor="$shadowColor"
            shadowRadius={20}
            shadowOffset={{ width: 0, height: 10 }}
            shadowOpacity={0.15}
            elevate
            animation={[
              "medium",
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
            enterStyle={{ y: -10, opacity: 0 }}
            exitStyle={{ y: -10, opacity: 0 }}
          >
            <Column gap="$3" width={280}>
              <Text size="$5" fontWeight="600" color="$text">
                Make an offer
              </Text>

              {/* Price Input */}
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "16px",
                    color: theme.text.val,
                    fontWeight: 500,
                    zIndex: 1,
                  }}
                >
                  £
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Your offer"
                  value={offerAmount}
                  onChange={(e) => {
                    setOfferAmount(e.target.value);
                    setOfferError("");
                  }}
                  disabled={submittingOffer}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 30px",
                    fontSize: "16px",
                    border: `1px solid ${offerError ? theme.error.val : theme.border.val}`,
                    borderRadius: "8px",
                    outline: "none",
                    fontFamily: "var(--font-urbanist)",
                    backgroundColor: theme.surface.val,
                    color: theme.text.val,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    if (!offerError) {
                      e.target.style.borderColor = theme.primary.val;
                    }
                  }}
                  onBlur={(e) => {
                    if (!offerError) {
                      e.target.style.borderColor = theme.border.val;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !submittingOffer) {
                      handleSubmitOffer();
                    }
                    if (e.key === "Escape") {
                      setPopoverOpen(false);
                    }
                  }}
                />
              </div>

              {offerError && (
                <Text size="$2" color="$error">
                  {offerError}
                </Text>
              )}

              <Row gap="$2" justifyContent="flex-end">
                <Popover.Close asChild>
                  <Button
                    size="$3"
                    backgroundColor="transparent"
                    color="$textSecondary"
                    borderRadius="$full"
                    paddingHorizontal="$3"
                  >
                    Cancel
                  </Button>
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
