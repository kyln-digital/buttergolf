"use client";

import { useState } from "react";
import { Column, Row, Text, Button, Heading, Popover, Input } from "@buttergolf/ui";
import { Heart, Info } from "@tamagui/lucide-icons";
import { getConditionLabel, calculateAverageCondition } from "@buttergolf/app";
import type { Product } from "../ProductDetailClient";

interface ProductInformationProps {
  product: Product;
  onBuyNow: () => void;
  onSubmitOffer: (amount: number) => Promise<void>;
}

/** Sellers grade each component from 1 (Poor) to 10 (Like New). */
const MAX_CONDITION_RATING = 10;

/**
 * Theme token for a component rating's progress bar, keyed off the same
 * boundaries as the shared `CONDITION_LABELS` scale so the colour can't say
 * "excellent" while the label next to it says "good".
 */
function getConditionColor(rating: number) {
  if (rating >= 10) return "$success" as const;
  if (rating >= 8) return "$secondary" as const;
  if (rating >= 5) return "$warning" as const;
  return "$error" as const;
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

  // Specs are built as a list so optional rows (Type, Shaft Flex, Loft, Head
  // Cover) stay aligned with their labels in the two-column layout below.
  const specs: { label: string; value: string }[] = [
    { label: "Category", value: product.category.name },
    // A Woods listing is really a Driver, Fairway Wood or Hybrid — show which,
    // rather than leaving the buyer with the generic parent category.
    ...(product.woodsSubcategory ? [{ label: "Type", value: product.woodsSubcategory }] : []),
    { label: "Brand", value: product.brand || "N/A" },
    { label: "Model", value: product.model || "N/A" },
    { label: "Condition", value: formatCondition(product.condition) },
    ...(product.flex ? [{ label: "Shaft Flex", value: product.flex }] : []),
    ...(product.loft ? [{ label: "Loft", value: product.loft }] : []),
    ...(product.headCoverIncluded === null
      ? []
      : [
          {
            label: "Head Cover",
            value: product.headCoverIncluded ? "Included" : "Not included",
          },
        ]),
  ];

  const { gripCondition, headCondition, shaftCondition } = product;
  const hasConditionRatings =
    gripCondition !== null && headCondition !== null && shaftCondition !== null;

  const conditionComponents = hasConditionRatings
    ? [
        { label: "Grip", value: gripCondition },
        { label: "Head", value: headCondition },
        { label: "Shaft", value: shaftCondition },
      ]
    : [];

  const averageCondition = hasConditionRatings
    ? calculateAverageCondition(gripCondition, headCondition, shaftCondition)
    : null;

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
            fill={isFavourite ? "currentColor" : "transparent"}
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
            <Text size="$3" color="$textSecondary" fontWeight="700">
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
                <Text size="$3" color="$text" fontWeight="600">
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
          {specs.map((spec) => (
            <Text key={spec.label} size="$3" color="$text" fontWeight="700" lineHeight="$3">
              {spec.label}
            </Text>
          ))}
        </Column>
        <Column gap="$sm" flex={1}>
          {specs.map((spec) => (
            <Text key={spec.label} size="$3" color="$text" lineHeight="$3">
              {spec.value}
            </Text>
          ))}
        </Column>
      </Row>

      {/* Divider */}
      <Column height={1} backgroundColor="$border" width="100%" />

      {/* Component condition ratings — sellers grade grip, head and shaft
          individually when listing, so buyers get to see the same detail. */}
      {hasConditionRatings && (
        <>
          <Column gap="$sm">
            <Row alignItems="center" justifyContent="space-between">
              <Text size="$3" color="$text" fontWeight="700">
                Condition Rating
              </Text>
              {averageCondition !== null && (
                <Text size="$3" color="$textSecondary">
                  {getConditionLabel(averageCondition)} ({averageCondition}/10)
                </Text>
              )}
            </Row>

            {conditionComponents.map(({ label, value }) => (
              <Row key={label} alignItems="center" gap="$sm">
                <Text size="$3" color="$textSecondary" width={48}>
                  {label}
                </Text>
                <Column flex={1} height={8} backgroundColor="$cloudMist" borderRadius="$full">
                  <Column
                    height={8}
                    width={`${(value / MAX_CONDITION_RATING) * 100}%`}
                    backgroundColor={getConditionColor(value)}
                    borderRadius="$full"
                  />
                </Column>
                <Text size="$3" color="$text" fontWeight="600" width={40} textAlign="right">
                  {value}/{MAX_CONDITION_RATING}
                </Text>
              </Row>
            ))}
          </Column>

          {/* Divider */}
          <Column height={1} backgroundColor="$border" width="100%" />
        </>
      )}

      {/* Product Description */}
      <Column gap="$md">
        <Text size="$3" color="$text" fontWeight="700">
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
          size="$5"
          placement="bottom"
          allowFlip
          stayInFrame
          offset={14}
          resize
          onOpenChange={(open) => {
            if (!open) {
              setOfferAmount("");
              setOfferError("");
            }
          }}
        >
          <Popover.Trigger asChild>
            <Button
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
            </Button>
          </Popover.Trigger>

          <Popover.Content
            className="offer-popover-content"
            backgroundColor="$surface"
            borderRadius="$lg"
            padding="$4"
            borderWidth={1}
            borderColor="$border"
            elevate
            boxShadow="0px 12px 30px rgba(0, 0, 0, 0.16)"
            style={{
              animationName: "offerPopoverEnter",
              animationDuration: "420ms",
              animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              animationFillMode: "both",
              willChange: "opacity, transform",
            }}
          >
            <Popover.Arrow
              size="$2"
              offset={10}
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$surface"
            />
            <Column gap="$3" width={280} animation="medium">
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
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
                  onSubmitEditing={!submittingOffer ? handleSubmitOffer : undefined}
                />
              </Row>

              {offerError ? (
                <Text size="$2" color="$error">
                  {offerError}
                </Text>
              ) : null}

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
