"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Column, Row, Text, Button, Heading, Popover, Input } from "@buttergolf/ui";
import { Heart } from "@tamagui/lucide-icons";
import { getConditionLabel, calculateAverageCondition } from "@buttergolf/app";
import { useFavouriteToggle } from "@/hooks/useFavouriteToggle";
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

/** "LIKE_NEW" → "Like new". */
function formatCondition(condition: string) {
  const words = condition.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Divider() {
  return <Column height={1} backgroundColor="$border" width="100%" />;
}

export function ProductInformation({ product, onBuyNow, onSubmitOffer }: ProductInformationProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isFavourited, toggleFavourite } = useFavouriteToggle(product.id);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerError, setOfferError] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  const handleFavourite = () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }
    void toggleFavourite();
  };

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

  const sellerName = `${product.user.firstName ?? ""} ${product.user.lastName ?? ""}`.trim();
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
    ...(product.flex ? [{ label: "Shaft flex", value: product.flex }] : []),
    ...(product.loft ? [{ label: "Loft", value: product.loft }] : []),
    ...(product.headCoverIncluded === null
      ? []
      : [
          {
            label: "Head cover",
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
      gap="$lg"
      width="100%"
      $gtMd={{
        width: 420,
        flexShrink: 0,
      }}
    >
      {/* Title, price, favourite */}
      <Row justifyContent="space-between" alignItems="flex-start" gap="$md">
        <Column gap="$xs" flex={1} minWidth={0}>
          <Heading level={1} size="$7" color="$text">
            {product.title}
          </Heading>
          <Text size="$9" fontWeight="700" color="$text">
            £{product.price.toFixed(2)}
          </Text>
        </Column>
        <Button
          butterVariant="icon"
          circular
          size={44}
          onPress={handleFavourite}
          aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={isFavourited}
        >
          <Heart
            size={20}
            fill={isFavourited ? "currentColor" : "transparent"}
            color={isFavourited ? "$primary" : "$text"}
            strokeWidth={2}
          />
        </Button>
      </Row>

      {/* Primary actions */}
      <Column gap="$sm" width="100%">
        <Button
          butterVariant="primary"
          size="$6"
          width="100%"
          disabled={product.isSold}
          onPress={onBuyNow}
        >
          {product.isSold ? "Sold out" : "Buy now"}
        </Button>

        <Popover
          size="$5"
          placement="bottom"
          allowFlip
          stayInFrame
          offset={12}
          resize
          onOpenChange={(open) => {
            if (!open) {
              setOfferAmount("");
              setOfferError("");
            }
          }}
        >
          <Popover.Trigger asChild>
            <Button butterVariant="secondary" size="$6" width="100%" disabled={product.isSold}>
              Make an offer
            </Button>
          </Popover.Trigger>

          <Popover.Content
            className="offer-popover-content"
            backgroundColor="$background"
            borderRadius="$lg"
            padding="$md"
            borderWidth={1}
            borderColor="$border"
            elevate
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
              backgroundColor="$background"
            />
            <Column gap="$sm" width={280}>
              <Heading level={2} size="$5" color="$text">
                Make an offer
              </Heading>

              <Row
                alignItems="center"
                borderWidth={1}
                borderColor={offerError ? "$error" : "$fieldBorder"}
                borderRadius="$full"
                backgroundColor="$background"
                overflow="hidden"
                paddingLeft="$md"
                focusWithinStyle={{ borderColor: "$primary" }}
              >
                <Text color="$text" fontWeight="500" userSelect="none">
                  £
                </Text>
                <Input
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="Your offer"
                  aria-label="Offer amount in pounds"
                  value={offerAmount}
                  onChangeText={(text) => {
                    const sanitised = text.replace(/[^0-9.]/g, "").replace(/(\..*?)\./g, "$1");
                    setOfferAmount(sanitised);
                    setOfferError("");
                  }}
                  disabled={submittingOffer}
                  autoFocus
                  flex={1}
                  size="lg"
                  borderWidth={0}
                  backgroundColor="transparent"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
                  hoverStyle={{ borderWidth: 0 }}
                  onSubmitEditing={!submittingOffer ? handleSubmitOffer : undefined}
                />
              </Row>

              {offerError ? (
                <Text size="$3" color="$error" role="alert">
                  {offerError}
                </Text>
              ) : null}

              <Row gap="$sm" justifyContent="flex-end">
                <Popover.Close asChild>
                  <Button butterVariant="ghost" size="$3">
                    Cancel
                  </Button>
                </Popover.Close>
                <Button
                  butterVariant="primary"
                  size="$3"
                  onPress={handleSubmitOffer}
                  disabled={submittingOffer || !offerAmount}
                >
                  {submittingOffer ? "Submitting..." : "Submit offer"}
                </Button>
              </Row>
            </Column>
          </Popover.Content>
        </Popover>
      </Column>

      <Divider />

      {/* Seller */}
      <Row alignItems="center" gap="$md">
        <Column gap={2} flex={1} minWidth={0}>
          <Text size="$3" color="$textSecondary">
            Sold by
          </Text>
          <Text size="$5" fontWeight="600" color="$text" numberOfLines={1}>
            {sellerName || "ButterGolf seller"}
          </Text>
        </Column>
        {ratingCount > 0 ? (
          <Row gap="$xs" alignItems="center" flexShrink={0}>
            <Text size="$4" color="$primary">
              ★
            </Text>
            <Text size="$4" color="$text" fontWeight="600">
              {averageRating.toFixed(1)}
            </Text>
            <Text size="$3" color="$textSecondary">
              ({ratingCount})
            </Text>
          </Row>
        ) : (
          <Column
            backgroundColor="$buttonSecondaryBg"
            paddingHorizontal="$sm"
            paddingVertical={2}
            borderRadius="$full"
            flexShrink={0}
          >
            <Text size="$1" fontWeight="600" color="$textSecondary">
              NEW SELLER
            </Text>
          </Column>
        )}
      </Row>

      <Divider />

      {/* Specifications */}
      <Column gap="$sm">
        <Heading level={2} size="$4" color="$text">
          Details
        </Heading>
        <Column gap="$xs">
          {specs.map((spec) => (
            <Row key={spec.label} gap="$md" alignItems="baseline">
              <Text size="$4" color="$textSecondary" width={120} flexShrink={0}>
                {spec.label}
              </Text>
              <Text size="$4" color="$text" flex={1}>
                {spec.value}
              </Text>
            </Row>
          ))}
        </Column>
      </Column>

      {/* Component condition ratings — sellers grade grip, head and shaft
          individually when listing, so buyers get to see the same detail. */}
      {hasConditionRatings && (
        <>
          <Divider />
          <Column gap="$sm">
            <Row alignItems="center" justifyContent="space-between">
              <Heading level={2} size="$4" color="$text">
                Condition rating
              </Heading>
              {averageCondition !== null && (
                <Text size="$4" color="$textSecondary">
                  {getConditionLabel(averageCondition)} ({averageCondition}/10)
                </Text>
              )}
            </Row>

            {conditionComponents.map(({ label, value }) => (
              <Row key={label} alignItems="center" gap="$sm">
                <Text size="$4" color="$textSecondary" width={48}>
                  {label}
                </Text>
                <Column
                  flex={1}
                  height={8}
                  backgroundColor="$backgroundHover"
                  borderRadius="$full"
                  overflow="hidden"
                >
                  <Column
                    height={8}
                    width={`${(value / MAX_CONDITION_RATING) * 100}%`}
                    backgroundColor={getConditionColor(value)}
                    borderRadius="$full"
                  />
                </Column>
                <Text size="$4" color="$text" fontWeight="600" width={40} textAlign="right">
                  {value}/{MAX_CONDITION_RATING}
                </Text>
              </Row>
            ))}
          </Column>
        </>
      )}

      <Divider />

      {/* Description */}
      <Column gap="$sm">
        <Heading level={2} size="$4" color="$text">
          Description
        </Heading>
        <Text size="$4" color="$text">
          {product.description}
        </Text>
      </Column>
    </Column>
  );
}
