"use client";

import { Platform } from "react-native";
import type { GestureResponderEvent } from "react-native";
import {
  Card,
  GlassmorphismCard,
  getGlassmorphismStyles,
  Column,
  Row,
  Text,
  Image,
  View,
} from "@buttergolf/ui";
import { Heart } from "@tamagui/lucide-icons";
import type { ProductCardData } from "../types/product";

export interface ProductCardProps {
  product: ProductCardData;
  /**
   * Web only: when set the card renders as a real anchor so open-in-new-tab,
   * copy-link and keyboard navigation work. Pair with a press handler that
   * calls `preventDefault` for plain clicks (see `useLinkPress` on web).
   */
  href?: string;
  onPress?: (event: GestureResponderEvent) => void;
  onFavourite?: (productId: string) => void;
  isFavourited?: boolean;
}

/** Two lines of the `$5` body size (22px line-height each). */
const TITLE_HEIGHT = 44;

const focusRing = {
  outlineColor: "$primary",
  outlineStyle: "solid",
  outlineWidth: 2,
  outlineOffset: 2,
} as const;

/**
 * Heart icon component (cross-platform via Tamagui Lucide).
 *
 * IMPORTANT: Do not use raw CSS colour strings here (for example rgba(...)).
 * Even though Lucide's base icon prop allows string values, Tamagui wraps the
 * icon props with themed token typing in this context, and raw colour literals
 * can fail TypeScript with:
 * "Type 'string' is not assignable to type GetThemeValueForKey<'color'>".
 *
 * Keep colour values as theme tokens (for example "$primary", "$textInverse")
 * and use opacity for subtle unfilled-state styling.
 */
function HeartIcon({ filled }: Readonly<{ filled: boolean }>) {
  return (
    <Heart
      size={20}
      color={filled ? "$primary" : "$textInverse"}
      fill={filled ? "currentColor" : "transparent"}
      opacity={filled ? 1 : 0.9}
      strokeWidth={2}
    />
  );
}

/**
 * ProductCard
 *
 * Flat, outlined card: image on top (4:3), title, price, seller. The whole card
 * is the link; the only other control is the favourite heart. Nothing moves on
 * hover - the border shifts one tone, matching the Button family.
 */
export function ProductCard({
  product,
  href,
  onPress,
  onFavourite,
  isFavourited = false,
}: Readonly<ProductCardProps>) {
  const isWeb = Platform.OS === "web";
  const sellerName = product.seller?.firstName || "Seller";
  const sellerRatingCount = product.seller?.ratingCount ?? 0;
  const sellerRating = product.seller?.averageRating;
  const anchorProps = isWeb && href ? { tag: "a" as const, href } : {};

  const handleFavouritePress = (event?: GestureResponderEvent) => {
    // The heart sits inside the card anchor: stop the card press and the
    // anchor's own navigation.
    event?.stopPropagation?.();
    (event as unknown as { preventDefault?: () => void } | undefined)?.preventDefault?.();
    onFavourite?.(product.id);
  };

  return (
    <Card
      variant="outlined"
      interactive
      padding={0}
      width="100%"
      backgroundColor="$card"
      borderRadius="$lg"
      overflow="hidden"
      onPress={onPress}
      focusable
      focusVisibleStyle={focusRing}
      {...anchorProps}
    >
      {/* Image - 4:3 */}
      <Column position="relative" width="100%" aspectRatio={4 / 3} overflow="hidden">
        <Image
          source={{ uri: product.imageUrl }}
          alt={product.title}
          width="100%"
          height="100%"
          objectFit="cover"
        />

        {/* Promotion badge - top left */}
        {product.activePromotion && (
          <View
            position="absolute"
            top="$sm"
            left="$sm"
            backgroundColor={product.activePromotion.type === "BUMP" ? "$primary" : "$success"}
            paddingHorizontal="$sm"
            paddingVertical="$xs"
            borderRadius="$full"
            zIndex={2}
          >
            <Text size="$1" fontWeight="700" color="$textInverse">
              {product.activePromotion.type === "BUMP" ? "BOOSTED" : "PRO SHOP"}
            </Text>
          </View>
        )}

        {/* Favourite - top right */}
        <GlassmorphismCard
          intensity="medium"
          position="absolute"
          top="$sm"
          right="$sm"
          width={36}
          height={36}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          zIndex={2}
          cursor="pointer"
          role="button"
          focusable
          aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={isFavourited}
          onPress={handleFavouritePress}
          pressStyle={{ scale: 0.92, opacity: 0.85 }}
          focusVisibleStyle={focusRing}
          style={isWeb ? getGlassmorphismStyles("medium") : undefined}
        >
          <HeartIcon filled={isFavourited} />
        </GlassmorphismCard>
      </Column>

      {/* Content */}
      <Column paddingHorizontal="$md" paddingTop="$sm" paddingBottom="$md" gap="$xs">
        <Text
          size="$5"
          fontWeight="600"
          color="$text"
          numberOfLines={2}
          height={TITLE_HEIGHT}
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

        <Text size="$6" fontWeight="700" color="$text">
          £{product.price.toFixed(2)}
        </Text>

        <Row alignItems="center" gap="$sm" flexWrap="wrap">
          <Text size="$4" color="$textSecondary" numberOfLines={1} flexShrink={1}>
            {sellerName}
          </Text>
          {sellerRatingCount > 0 ? (
            <Row alignItems="center" gap="$xs">
              <Text color="$primary" size="$4">
                ★
              </Text>
              <Text size="$4" fontWeight="500" color="$textSecondary">
                {sellerRating?.toFixed(1)}
              </Text>
            </Row>
          ) : (
            <View
              backgroundColor="$buttonSecondaryBg"
              paddingHorizontal="$sm"
              paddingVertical={2}
              borderRadius="$full"
            >
              <Text size="$1" fontWeight="600" color="$textSecondary">
                NEW SELLER
              </Text>
            </View>
          )}
        </Row>
      </Column>
    </Card>
  );
}
