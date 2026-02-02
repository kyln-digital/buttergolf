"use client";

import { Row, Column, Text, Button, Image } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { PLACEHOLDER_IMAGE_URL } from "@buttergolf/constants";
import { Trash2 } from "@tamagui/lucide-icons";

interface HorizontalProductCardProps {
  readonly product: ProductCardData & { description?: string };
  readonly onMakeOffer: (productId: string) => void;
  readonly onBuyNow: (productId: string) => void;
  readonly onRemove: (productId: string) => void;
  readonly onViewDetails: (productId: string) => void;
}

export function HorizontalProductCard({
  product,
  onMakeOffer,
  onBuyNow,
  onRemove,
  onViewDetails,
}: HorizontalProductCardProps) {
  const isSold = product.condition === null; // Simplified sold check

  return (
    <Row
      backgroundColor="$cloudMist"
      borderRadius="$lg"
      padding="$md"
      gap="$lg"
      alignItems="center"
      width="100%"
      shadowColor="rgba(0,0,0,0.08)"
      shadowOffset={{ width: 0, height: 2 }}
      shadowRadius={8}
      elevation={2}
      flexDirection="row"
      $sm={{
        flexDirection: "column",
        gap: "$md",
        alignItems: "stretch",
      }}
      hoverStyle={{
        shadowColor: "rgba(0,0,0,0.12)",
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
      }}
    >
      {/* Product Image - Left (clickable) - 4:3 aspect ratio */}
      <Image
        source={{ uri: product.imageUrl || PLACEHOLDER_IMAGE_URL }}
        alt={product.title}
        width={160}
        height={120}
        borderRadius="$md"
        backgroundColor={product.imageUrl ? "transparent" : "$border"}
        style={{
          objectFit: product.imageUrl ? "cover" : "contain",
          cursor: "pointer",
        }}
        onPress={() => onViewDetails(product.id)}
        $sm={{
          width: "100%",
          height: 200,
          alignSelf: "center",
        }}
      />

      {/* Product Info - Center (Flex Grow) */}
      <Column flex={1} gap="$sm" minWidth={0}>
        {/* Title */}
        <Text size="$6" fontWeight="700" color="$text" numberOfLines={2}>
          {product.title}
        </Text>

        {/* Category */}
        <Text size="$4" color="$textSecondary">
          {product.category || "Uncategorized"}
        </Text>

        {/* Price */}
        <Text size="$7" fontWeight="700" color="$primary">
          £{product.price.toFixed(2)}
        </Text>

        {/* Description */}
        {product.description && (
          <Text size="$4" color="$textSecondary" numberOfLines={2} ellipsizeMode="tail">
            {product.description}
          </Text>
        )}

        {/* Seller Info */}
        <Row gap="$xs" alignItems="center">
          <Text size="$3" color="$textSecondary">
            Sold by {product.seller.firstName || "Unknown"}
          </Text>
          {product.seller.ratingCount > 0 && (
            <>
              <Text size="$3" color="$textSecondary">
                •
              </Text>
              <Row gap="$xs" alignItems="center">
                <Text color="$primary" size="$2">
                  ★
                </Text>
                <Text size="$3" color="$textSecondary">
                  {product.seller.averageRating?.toFixed(1)} ({product.seller.ratingCount})
                </Text>
              </Row>
            </>
          )}
        </Row>
      </Column>

      {/* Action Buttons - Right */}
      <Row
        gap="$sm"
        flexShrink={0}
        flexDirection="row"
        flexWrap="wrap"
        $sm={{
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        {/* Buy Now Button */}
        <Button
          butterVariant="primary"
          size="$4"
          disabled={isSold}
          onPress={() => onBuyNow(product.id)}
          minWidth={120}
          $sm={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {isSold ? "Sold Out" : "Buy now"}
        </Button>

        {/* Make an Offer Button */}
        <Button
          butterVariant="secondary"
          size="$4"
          disabled={isSold}
          onPress={() => onMakeOffer(product.id)}
          minWidth={120}
          $sm={{
            flex: 1,
            minWidth: 0,
          }}
        >
          Make an offer
        </Button>

        {/* Remove from Favourites Button */}
        <Button
          size="$4"
          backgroundColor="$surface"
          color="$error"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$full"
          width={48}
          height={48}
          padding={0}
          justifyContent="center"
          alignItems="center"
          onPress={() => onRemove(product.id)}
          hoverStyle={{
            backgroundColor: "$errorLight",
            borderColor: "$error",
          }}
          aria-label="Remove from favourites"
        >
          <Trash2 size={20} />
        </Button>
      </Row>
    </Row>
  );
}
