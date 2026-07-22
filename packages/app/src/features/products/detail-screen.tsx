"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Column,
  Row,
  ScrollView,
  Text,
  Heading,
  Button,
  Badge,
  Image,
  Spinner,
  Card,
  View,
} from "@buttergolf/ui";
import type { Product } from "../../types/product";
import { useLink } from "solito/navigation";
import { routes } from "../../navigation";
import { ArrowLeft, Heart, Eye } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfferSheet } from "./OfferSheet";

// Helper to format condition rating (1-10) to label
function getConditionLabel(rating: number): string {
  if (rating >= 9) return "Like New";
  if (rating >= 7) return "Excellent";
  if (rating >= 5) return "Good";
  if (rating >= 3) return "Fair";
  return "Poor";
}

// Helper to get condition color - returns theme token
function getConditionColor(rating: number) {
  if (rating >= 9) return "$success" as const;
  if (rating >= 7) return "$secondary" as const;
  if (rating >= 5) return "$warning" as const;
  return "$error" as const;
}

interface ProductDetailScreenProps {
  productId: string;
  onFetchProduct?: (id: string) => Promise<Product | null>;
  /** Optional callback for back navigation (used on mobile for goBack) */
  onBack?: () => void;
  /** Callback when user wants to buy now - receives productId and price */
  onBuyNow?: (productId: string, price: number) => void;
  /** Callback when user wants to make an offer - receives productId, price, and the offer amount */
  onMakeOffer?: (productId: string, price: number, offerAmount: number) => Promise<void>;
  /** Whether the user is authenticated (for showing proper auth prompts) */
  isAuthenticated?: boolean;
  /** Whether this product is currently favourited (controls the heart icon fill). */
  isFavourited?: boolean;
  /**
   * Toggle this product as a favourite. Wired like CategoryList/Home.
   * TODO: the mobile ProductDetail wrapper does not yet pass this prop, so the
   * heart is a no-op there until favourites state is threaded through. Defaults
   * to a no-op so the button is always safe to render/press.
   */
  onToggleFavourite?: (productId: string) => void;
}

export function ProductDetailScreen({
  productId,
  onFetchProduct,
  onBack,
  onBuyNow,
  onMakeOffer,
  isAuthenticated = true,
  isFavourited = false,
  onToggleFavourite,
}: Readonly<ProductDetailScreenProps>) {
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);

  // Use Solito link for web, but prefer onBack prop for mobile navigation
  const backLink = useLink({ href: routes.products });
  const handleBack = onBack ?? backLink.onPress;

  const fetchProduct = useCallback(async () => {
    if (!onFetchProduct || !productId) {
      setLoading(false);
      setError("No product ID provided");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedProduct = await onFetchProduct(productId);
      if (fetchedProduct) {
        setProduct(fetchedProduct);
      } else {
        setError("Product not found");
      }
    } catch (err) {
      console.error("Failed to fetch product:", err);
      setError("Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [onFetchProduct, productId]);

  useEffect(() => {
    void fetchProduct();
  }, [fetchProduct]);

  if (loading) {
    return (
      <Column
        flex={1}
        backgroundColor="$primary"
        alignItems="center"
        justifyContent="center"
        paddingTop={insets.top}
      >
        <Spinner size="lg" color="$pureWhite" />
        <Text color="$textInverse" marginTop="$3">
          Loading product...
        </Text>
      </Column>
    );
  }

  if (error || !product) {
    return (
      <Column
        flex={1}
        backgroundColor="$background"
        padding="$4"
        paddingTop={insets.top + 16}
        gap="$4"
      >
        <Button onPress={handleBack} size="$4" icon={ArrowLeft}>
          Back
        </Button>
        <Column alignItems="center" justifyContent="center" flex={1}>
          <Text color="$error" size="$6">
            {error || "Product not found"}
          </Text>
        </Column>
      </Column>
    );
  }

  const primaryImage = product.images?.[0]?.url || "";
  const formattedCondition = product.condition?.replace("_", " ") || "Unknown";
  const sellerName =
    `${product.user.firstName || ""} ${product.user.lastName || ""}`.trim() || "Anonymous";

  // Calculate average condition from individual ratings
  const hasConditionRatings =
    product.gripCondition && product.headCondition && product.shaftCondition;
  const avgCondition = hasConditionRatings
    ? Math.round((product.gripCondition! + product.headCondition! + product.shaftCondition!) / 3)
    : null;

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <Column>
        {/* Product Image */}
        {primaryImage && (
          <View position="relative">
            <Image
              source={{ uri: primaryImage }}
              width="100%"
              height={400}
              objectFit="cover"
              backgroundColor="$gray100"
            />
            {/* Back button overlay */}
            <Button
              onPress={handleBack}
              position="absolute"
              top="$4"
              left="$4"
              size="$4"
              circular
              backgroundColor="$primary"
              pressStyle={{ backgroundColor: "$primaryPress" }}
              aria-label="Go back"
              accessibilityLabel="Go back"
              icon={<ArrowLeft size={20} color="$pureWhite" />}
            />
            {/* Action buttons overlay */}
            <Row position="absolute" top="$4" right="$4" gap="$2">
              <Button
                size="$4"
                circular
                backgroundColor="$primary"
                pressStyle={{ backgroundColor: "$primaryPress" }}
                aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
                accessibilityLabel={isFavourited ? "Remove from favourites" : "Add to favourites"}
                onPress={() => onToggleFavourite?.(productId)}
                icon={
                  <Heart
                    size={20}
                    color="$pureWhite"
                    // RN SVG does not reliably honour CSS currentColor; match $pureWhite.
                    fill={isFavourited ? "#FFFFFF" : "none"}
                  />
                }
              />
            </Row>
            {/* Sold badge */}
            {product.isSold && (
              <View
                position="absolute"
                bottom="$4"
                left="$4"
                backgroundColor="$error"
                paddingHorizontal="$4"
                paddingVertical="$2"
                borderRadius="$lg"
              >
                <Text color="$pureWhite" fontWeight="700" size="$5">
                  SOLD
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Product Details */}
        <Column padding="$4" gap="$4">
          {/* Price and Title */}
          <Column gap="$2">
            <Text size="$9" fontWeight="800" color="$primary">
              £{product.price.toFixed(2)}
            </Text>
            <Heading level={2}>{product.title}</Heading>

            {/* Category, Brand, Model */}
            <Row gap="$2" alignItems="center" flexWrap="wrap">
              <Badge variant="neutral" size="sm">
                <Text size="$2" fontWeight="500">
                  {product.category.name}
                </Text>
              </Badge>
              {product.brand && (
                <Badge variant="primary" size="sm">
                  <Text size="$2" fontWeight="500" color="$textInverse">
                    {product.brand.name}
                  </Text>
                </Badge>
              )}
              {product.model && (
                <Text size="$4" color="$textSecondary">
                  Model: {product.model}
                </Text>
              )}
            </Row>

            {/* Views counter */}
            <Row alignItems="center" gap="$1">
              <Eye size={14} color="$textSecondary" />
              <Text size="$3" color="$textSecondary">
                {product.views} views
              </Text>
            </Row>
          </Column>

          {/* Golf-Specific Details Card */}
          {(product.flex ||
            product.loft ||
            product.woodsSubcategory ||
            product.headCoverIncluded !== null) && (
            <Card variant="outlined" padding="$lg">
              <Column gap="$3">
                <Text size="$5" fontWeight="700" color="$text">
                  Club Details
                </Text>
                <Row flexWrap="wrap" gap="$4">
                  {product.woodsSubcategory && (
                    <Column gap="$1">
                      <Text size="$3" color="$textSecondary">
                        Type
                      </Text>
                      <Text size="$5" fontWeight="600">
                        {product.woodsSubcategory}
                      </Text>
                    </Column>
                  )}
                  {product.flex && (
                    <Column gap="$1">
                      <Text size="$3" color="$textSecondary">
                        Shaft Flex
                      </Text>
                      <Text size="$5" fontWeight="600">
                        {product.flex}
                      </Text>
                    </Column>
                  )}
                  {product.loft && (
                    <Column gap="$1">
                      <Text size="$3" color="$textSecondary">
                        Loft
                      </Text>
                      <Text size="$5" fontWeight="600">
                        {product.loft}
                      </Text>
                    </Column>
                  )}
                  {product.headCoverIncluded !== null && (
                    <Column gap="$1">
                      <Text size="$3" color="$textSecondary">
                        Head Cover
                      </Text>
                      <Text size="$5" fontWeight="600">
                        {product.headCoverIncluded ? "Included" : "Not Included"}
                      </Text>
                    </Column>
                  )}
                </Row>
              </Column>
            </Card>
          )}

          {/* Condition Rating Card */}
          {hasConditionRatings && (
            <Card variant="outlined" padding="$lg">
              <Column gap="$3">
                <Row alignItems="center" justifyContent="space-between">
                  <Text size="$5" fontWeight="700" color="$text">
                    Condition Rating
                  </Text>
                  {avgCondition && (
                    <Badge variant="success" size="sm">
                      <Text size="$3" fontWeight="600">
                        {getConditionLabel(avgCondition)} ({avgCondition}/10)
                      </Text>
                    </Badge>
                  )}
                </Row>

                {/* Individual ratings */}
                <Column gap="$3">
                  {/* Grip */}
                  <Row alignItems="center" gap="$3">
                    <Text size="$4" color="$textSecondary" width={60}>
                      Grip
                    </Text>
                    <View flex={1} height={8} backgroundColor="$cloudMist" borderRadius="$full">
                      <View
                        height={8}
                        width={`${(product.gripCondition! / 10) * 100}%`}
                        backgroundColor={getConditionColor(product.gripCondition!)}
                        borderRadius="$full"
                      />
                    </View>
                    <Text size="$4" fontWeight="600" width={30} textAlign="right">
                      {product.gripCondition}/10
                    </Text>
                  </Row>

                  {/* Head */}
                  <Row alignItems="center" gap="$3">
                    <Text size="$4" color="$textSecondary" width={60}>
                      Head
                    </Text>
                    <View flex={1} height={8} backgroundColor="$cloudMist" borderRadius="$full">
                      <View
                        height={8}
                        width={`${(product.headCondition! / 10) * 100}%`}
                        backgroundColor={getConditionColor(product.headCondition!)}
                        borderRadius="$full"
                      />
                    </View>
                    <Text size="$4" fontWeight="600" width={30} textAlign="right">
                      {product.headCondition}/10
                    </Text>
                  </Row>

                  {/* Shaft */}
                  <Row alignItems="center" gap="$3">
                    <Text size="$4" color="$textSecondary" width={60}>
                      Shaft
                    </Text>
                    <View flex={1} height={8} backgroundColor="$cloudMist" borderRadius="$full">
                      <View
                        height={8}
                        width={`${(product.shaftCondition! / 10) * 100}%`}
                        backgroundColor={getConditionColor(product.shaftCondition!)}
                        borderRadius="$full"
                      />
                    </View>
                    <Text size="$4" fontWeight="600" width={30} textAlign="right">
                      {product.shaftCondition}/10
                    </Text>
                  </Row>
                </Column>
              </Column>
            </Card>
          )}

          {/* Legacy condition badge (if no individual ratings) */}
          {!hasConditionRatings && product.condition && (
            <Card variant="outlined" padding="$lg">
              <Row alignItems="center" justifyContent="space-between">
                <Text size="$5" fontWeight="700" color="$text">
                  Condition
                </Text>
                <Badge variant="neutral" size="md">
                  <Text size="$4" fontWeight="500">
                    {formattedCondition}
                  </Text>
                </Badge>
              </Row>
            </Card>
          )}

          {/* Description */}
          {product.description && (
            <Card variant="outlined" padding="$lg">
              <Column gap="$2">
                <Text size="$5" fontWeight="700" color="$text">
                  Description
                </Text>
                <Text size="$5" color="$text" lineHeight={24}>
                  {product.description}
                </Text>
              </Column>
            </Card>
          )}

          {/* Seller Info */}
          <Card variant="outlined" padding="$lg">
            <Column gap="$3">
              <Text size="$5" fontWeight="700" color="$text">
                Seller
              </Text>
              <Row gap="$3" alignItems="center">
                {product.user.imageUrl ? (
                  <Image
                    source={{ uri: product.user.imageUrl }}
                    width={50}
                    height={50}
                    borderRadius={25}
                  />
                ) : (
                  <View
                    width={50}
                    height={50}
                    borderRadius={25}
                    backgroundColor="$primary"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="$pureWhite" fontWeight="700" size="$6">
                      {sellerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Column gap="$1">
                  <Text size="$5" fontWeight="600">
                    {sellerName}
                  </Text>
                  <Text size="$3" color="$textSecondary">
                    Member since {new Date(product.createdAt).getFullYear()}
                  </Text>
                </Column>
              </Row>
            </Column>
          </Card>

          {/* Additional Images */}
          {product.images && product.images.length > 1 && (
            <Column gap="$3">
              <Text size="$5" fontWeight="700" color="$text">
                More Photos ({product.images.length - 1})
              </Text>
              <Row gap="$2" flexWrap="wrap">
                {product.images.slice(1).map((image, index) => (
                  <Image
                    key={`${image.url}-${index}`}
                    source={{ uri: image.url }}
                    width={100}
                    height={100}
                    objectFit="cover"
                    borderRadius="$md"
                    backgroundColor="$gray100"
                  />
                ))}
              </Row>
            </Column>
          )}

          {/* Action Buttons */}
          <Column gap="$3" marginTop="$2">
            {!product.isSold ? (
              <>
                <Button
                  butterVariant="primary"
                  size="$5"
                  width="100%"
                  onPress={() => onBuyNow?.(product.id, product.price)}
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? "Buy Now" : "Sign in to Buy"}
                </Button>
                <Button
                  butterVariant="secondary"
                  size="$5"
                  width="100%"
                  onPress={() => setOfferSheetOpen(true)}
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? "Make an Offer" : "Sign in to Make Offer"}
                </Button>
              </>
            ) : (
              <Button size="$5" width="100%" backgroundColor="$cloudMist" disabled>
                <Text color="$textSecondary" fontWeight="600">
                  This item has been sold
                </Text>
              </Button>
            )}
          </Column>
        </Column>
      </Column>

      {/* Offer Sheet */}
      {product && (
        <OfferSheet
          open={offerSheetOpen}
          onOpenChange={setOfferSheetOpen}
          productPrice={product.price}
          onSubmit={async (amount) => {
            await onMakeOffer?.(product.id, product.price, amount);
          }}
        />
      )}
    </ScrollView>
  );
}
