"use client";

import { useState } from "react";
import { Platform } from "react-native";
import {
  Card,
  GlassmorphismCard,
  getGlassmorphismStyles,
  Column,
  Row,
  Text,
  Image,
  View,
  Button,
} from "@buttergolf/ui";
import { Heart } from "@tamagui/lucide-icons";
import type { ProductCardData } from "../types/product";

export interface ProductCardProps {
  product: ProductCardData;
  onPress?: () => void;
  onFavourite?: (productId: string) => void;
  isFavourited?: boolean;
  onQuickView?: (productId: string) => void;
}

// Heart icon component that works on both platforms
function HeartIcon({ filled }: Readonly<{ filled: boolean }>) {
  if (Platform.OS === "web") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={filled ? "#F45314" : "none"}
        stroke="#F45314"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  // For native, use lucide Heart icon with proper styling
  return (
    <Heart size={18} color="#F45314" fill={filled ? "#F45314" : "transparent"} strokeWidth={2.5} />
  );
}

/**
 * ProductCard - Shopify/Airbnb style layout
 *
 * Layout: Image on top (4:3 aspect ratio), content area below (96px)
 * Only overlays on image: favourite heart (top-right), optional condition badge (top-left)
 * Desktop hover: reveals quick action buttons at bottom of image
 */
export function ProductCard({
  product,
  onPress,
  onFavourite,
  isFavourited = false,
  onQuickView,
}: Readonly<ProductCardProps>) {
  const [isHovered, setIsHovered] = useState(false);

  const handleFavouriteClick = () => {
    onFavourite?.(product.id);
  };

  const isWeb = Platform.OS === "web";
  const sellerName = product.seller?.firstName || "Seller";
  const isNewSeller = product.seller?.ratingCount === 0;
  const sellerRatingCount = product.seller?.ratingCount ?? 0;

  return (
    <Card
      variant="elevated"
      padding={0}
      backgroundColor="$card"
      borderColor="$border"
      borderWidth={1}
      borderRadius={16}
      cursor="pointer"
      onPress={onPress}
      width="100%"
      overflow="hidden"
      onMouseEnter={isWeb ? () => setIsHovered(true) : undefined}
      onMouseLeave={isWeb ? () => setIsHovered(false) : undefined}
      style={
        isWeb
          ? {
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
            }
          : undefined
      }
      hoverStyle={{
        borderColor: "$borderHover",
      }}
    >
      {/* Image Area - 4:3 aspect ratio */}
      <Column position="relative" width="100%" aspectRatio={4 / 3} overflow="hidden">
        <Image
          source={{ uri: product.imageUrl }}
          alt={product.title}
          width="100%"
          height="100%"
          objectFit="cover"
          borderTopLeftRadius={16}
          borderTopRightRadius={16}
        />

        {/* Promotion Badge - Top Left */}
        {product.activePromotion && (
          <View
            position="absolute"
            top={10}
            left={10}
            backgroundColor={product.activePromotion.type === "BUMP" ? "$primary" : "#02aaa4"}
            paddingHorizontal={10}
            paddingVertical={4}
            borderRadius={12}
            zIndex={2}
          >
            <Row alignItems="center" gap={4}>
              <Text size="$2" fontWeight="700" color="$textInverse">
                {product.activePromotion.type === "BUMP" ? "🔥 BOOSTED" : "⭐ PRO SHOP"}
              </Text>
            </Row>
          </View>
        )}

        {/* Favourite Heart Button - Top Right with Glassmorphism */}
        <GlassmorphismCard
          intensity="medium"
          blur="medium"
          position="absolute"
          top={10}
          right={10}
          width={36}
          height={36}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          zIndex={2}
          cursor="pointer"
          onPress={(e) => {
            e?.stopPropagation?.();
            handleFavouriteClick();
          }}
          hoverStyle={{ transform: "scale(1.1)" }}
          pressStyle={{ transform: "scale(0.9)", opacity: 0.8 }}
          animation="quick"
          role="button"
          aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
          style={
            isWeb
              ? {
                  ...getGlassmorphismStyles("medium"),
                  transition: "transform 0.15s ease-out, opacity 0.15s ease-out",
                }
              : undefined
          }
        >
          <HeartIcon filled={isFavourited} />
        </GlassmorphismCard>

        {/* Hover Actions Overlay - Desktop only */}
        {isWeb && onQuickView && (
          <View
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            paddingHorizontal={12}
            paddingVertical={12}
            zIndex={3}
            style={{
              background: "linear-gradient(transparent, rgba(0,0,0,0.5))",
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              pointerEvents: isHovered ? "auto" : "none",
            }}
          >
            <Row justifyContent="center">
              <Button
                butterVariant="primary"
                size="$4"
                borderRadius="$full"
                paddingHorizontal="$6"
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onQuickView(product.id);
                }}
              >
                View
              </Button>
            </Row>
          </View>
        )}
      </Column>

      {/* Content Area - Fixed height for consistent grid alignment */}
      <Column
        paddingHorizontal={16}
        paddingVertical={14}
        gap={6}
        minHeight={96}
        justifyContent="flex-start"
      >
        {/* Title - 2 lines max with line-clamp */}
        <Text
          size="$5"
          fontWeight="600"
          color="$text"
          numberOfLines={2}
          height={40}
          style={
            isWeb
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }
              : undefined
          }
        >
          {product.title}
        </Text>

        {/* Price Row */}
        <Text size="$6" fontWeight="700" color="$text">
          £{product.price.toFixed(2)}
        </Text>

        {/* Seller + Rating Row */}
        <Row alignItems="center" gap={6} flexWrap="wrap">
          <Text size="$4" color="$textSecondary" numberOfLines={1} flexShrink={1}>
            {sellerName}
          </Text>
          {sellerRatingCount > 0 ? (
            <Row alignItems="center" gap={3}>
              <Text color="$primary" size="$4">
                ★
              </Text>
              <Text size="$4" fontWeight="500" color="$textSecondary">
                {product.seller?.averageRating?.toFixed(1)}
              </Text>
            </Row>
          ) : isNewSeller ? (
            <View
              backgroundColor="$primary"
              paddingHorizontal={8}
              paddingVertical={2}
              borderRadius={10}
            >
              <Text size="$2" fontWeight="600" color="$textInverse">
                NEW SELLER
              </Text>
            </View>
          ) : null}
        </Row>
      </Column>
    </Card>
  );
}
