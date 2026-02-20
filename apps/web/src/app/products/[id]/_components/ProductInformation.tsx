"use client";

import { useState } from "react";
import { Column, Row, Text, Button, Heading, Popover } from "@buttergolf/ui";
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
      backgroundColor="$cloudMist"
      borderRadius="$xl"
      padding="$lg"
      gap="$md"
      width="100%"
      $md={{
        width: 420,
        flexShrink: 0,
      }}
    >
      {/* Header: Title, Price, Favourite */}
      <Row justifyContent="space-between" alignItems="flex-start" gap="$sm">
        <Column gap="$xs" flex={1}>
          <Heading level={2} size="$7" color="$ironstone">
            {product.title}
          </Heading>
          <Row alignItems="baseline" gap="$sm">
            <Text fontSize={20} fontWeight="700" color="$spicedClementine">
              £{product.price.toFixed(2)}
            </Text>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid #545454",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "10px",
                color: "#545454",
              }}
              title="Price information"
            >
              i
            </div>
          </Row>
        </Column>
        <button
          onClick={() => setIsFavourite(!isFavourite)}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "white",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            padding: 0,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isFavourite ? "#F45314" : "none"}
            stroke={isFavourite ? "#F45314" : "#323232"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </Row>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "#CCCCCC", width: "100%" }} />

      {/* Seller Info */}
      <Column gap="$sm">
        <Row justifyContent="space-between" alignItems="center">
          <Column gap="$xs" flex={1}>
            <Text size="$3" color="$slateSmoke" weight="bold">
              Posted by {`${product.user.firstName} ${product.user.lastName}`.trim() || "Unknown"}
            </Text>
            <Text size="$2" color="$slateSmoke">
              Member for 3 years
            </Text>
            {ratingCount > 0 && (
              <Row gap="$xs" alignItems="center">
                <span style={{ color: "#F45314", fontSize: "14px" }}>★</span>
                <Text size="$3" color="$ironstone" weight="semibold">
                  {averageRating.toFixed(1)}
                </Text>
                <Text size="$2" color="$slateSmoke">
                  ({ratingCount})
                </Text>
              </Row>
            )}
          </Column>
          <Button
            size="$4"
            backgroundColor="$spicedClementine"
            color="$vanillaCream"
            borderRadius="$full"
            paddingHorizontal="$5"
            hoverStyle={{ backgroundColor: "$spicedClementineHover" }}
          >
            View profile
          </Button>
        </Row>
      </Column>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "#CCCCCC", width: "100%" }} />

      {/* Product Specifications */}
      <Row gap="$md">
        <Column gap="$sm" flex={1}>
          <Text size="$3" color="$ironstone" weight="bold" lineHeight="$3">
            Category
          </Text>
          <Text size="$3" color="$ironstone" weight="bold" lineHeight="$3">
            Brand
          </Text>
          <Text size="$3" color="$ironstone" weight="bold" lineHeight="$3">
            Product
          </Text>
          <Text size="$3" color="$ironstone" weight="bold" lineHeight="$3">
            Product
          </Text>
          <Text size="$3" color="$ironstone" weight="bold" lineHeight="$3">
            Condition
          </Text>
        </Column>
        <Column gap="$sm" flex={1}>
          <Text size="$3" color="$ironstone" lineHeight="$3">
            {product.category.name}
          </Text>
          <Text size="$3" color="$ironstone" lineHeight="$3">
            {product.brand || "N/A"}
          </Text>
          <Text size="$3" color="$ironstone" lineHeight="$3">
            {product.model || "N/A"}
          </Text>
          <Text size="$3" color="$ironstone" lineHeight="$3">
            {product.model || "N/A"}
          </Text>
          <Text size="$3" color="$ironstone" lineHeight="$3">
            {formatCondition(product.condition)}
          </Text>
        </Column>
      </Row>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "#CCCCCC", width: "100%" }} />

      {/* Product Description */}
      <Column gap="$md">
        <Text size="$3" color="$ironstone" weight="bold">
          Product Description
        </Text>
        <Text size="$3" color="$ironstone">
          {product.description}
        </Text>
      </Column>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "#CCCCCC", width: "100%" }} />

      {/* CTA Buttons */}
      <Column gap="$md" width="100%">
        <Button
          size="$5"
          width="100%"
          backgroundColor="$spicedClementine"
          color="$vanillaCream"
          borderRadius="$full"
          height={56}
          disabled={product.isSold}
          onPress={onBuyNow}
          pressStyle={{ backgroundColor: "$spicedClementinePress" }}
          hoverStyle={{ backgroundColor: "$spicedClementineHover" }}
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
                    color: "#323232",
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
                    border: `1px solid ${offerError ? "#dc2626" : "#EDEDED"}`,
                    borderRadius: "8px",
                    outline: "none",
                    fontFamily: "var(--font-urbanist)",
                    backgroundColor: "white",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    if (!offerError) {
                      e.target.style.borderColor = "#F45314";
                    }
                  }}
                  onBlur={(e) => {
                    if (!offerError) {
                      e.target.style.borderColor = "#EDEDED";
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

      {/* View Price Breakdown Link */}
      <Row justifyContent="center" width="100%">
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "#545454",
            fontSize: "14px",
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
          }}
        >
          View price breakdown
        </button>
      </Row>
    </Column>
  );
}
