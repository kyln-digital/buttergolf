"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Column, Row, ScrollView, Text, Heading, Spinner, Button, Image } from "@buttergolf/ui";
import { PLACEHOLDER_IMAGE_URL } from "@buttergolf/constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, Trash2, ArrowLeft } from "@tamagui/lucide-icons";
import type { ProductCardData } from "../../types/product";
import { MobileBottomNav } from "../../components/mobile";

interface FavouriteProduct extends ProductCardData {
  favouritedAt?: string;
  description?: string;
}

interface FavouritesScreenProps {
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Callback to fetch favourites from API */
  onFetchFavourites?: () => Promise<{
    products: FavouriteProduct[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  /** Callback to remove a product from favourites */
  onRemoveFavourite?: (productId: string) => Promise<void>;
  /** Navigate back */
  onBack?: () => void;
  /** Navigate to product detail */
  onViewProduct?: (productId: string) => void;
  /** Navigate to checkout/buy */
  onBuyNow?: (productId: string) => void;
  /** Navigate to make offer */
  onMakeOffer?: (productId: string) => void;
  /** Navigate to listings page */
  onBrowseListings?: () => void;
  /** Bottom nav handlers */
  onHomePress?: () => void;
  onSellPress?: () => void;
  onMessagesPress?: () => void;
  onLoginPress?: () => void;
  onAccountPress?: () => void;
}

export function FavouritesScreen({
  isAuthenticated = false,
  onFetchFavourites,
  onRemoveFavourite,
  onBack,
  onViewProduct,
  onBuyNow,
  onMakeOffer,
  onBrowseListings,
  onHomePress,
  onSellPress,
  onMessagesPress,
  onLoginPress,
  onAccountPress,
}: Readonly<FavouritesScreenProps>) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<FavouriteProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch favourites on mount
  useEffect(() => {
    if (!onFetchFavourites) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await onFetchFavourites!();
        if (!cancelled) {
          setProducts(data.products);
        }
      } catch (err) {
        console.error("Error fetching favourites:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load favourites");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [onFetchFavourites]);

  // Handle removing a favourite
  const handleRemove = useCallback(
    async (productId: string) => {
      if (!onRemoveFavourite) return;

      // Store the product before removal for potential rollback
      const productToRemove = products.find((p) => p.id === productId);

      try {
        setRemovingId(productId);
        // Optimistically remove from UI first
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        await onRemoveFavourite(productId);
      } catch (err) {
        console.error("Error removing favourite:", err);
        // Restore the product on error
        if (productToRemove) {
          setProducts((prev) => [...prev, productToRemove]);
        }
        setError("Failed to remove from favourites");
      } finally {
        setRemovingId(null);
      }
    },
    [onRemoveFavourite, products]
  );

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <Column flex={1} backgroundColor="$background">
        <Column
          paddingTop={insets.top + 16}
          paddingHorizontal="$4"
          paddingBottom="$4"
          backgroundColor="$background"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <Row alignItems="center" gap="$3">
            {onBack && (
              <Column
                onPress={onBack}
                padding="$2"
                borderRadius="$full"
                pressStyle={{ opacity: 0.7 }}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={24} color="$text" />
              </Column>
            )}
            <Heading level={2} color="$text">
              My Favourites
            </Heading>
          </Row>
        </Column>

        <Column flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$4">
          <Heart size={64} color="$border" />
          <Heading level={3} color="$text" textAlign="center">
            Sign in to view your favourites
          </Heading>
          <Text size="$5" color="$textSecondary" textAlign="center">
            Save your favourite golf equipment and access them from any device.
          </Text>
          <Button butterVariant="primary" size="$5" marginTop="$4" onPress={onLoginPress}>
            Sign In
          </Button>
        </Column>

        {/* Bottom Navigation */}
        <Column position="absolute" bottom={0} left={0} right={0} zIndex={100}>
          <MobileBottomNav
            activeTab="wishlist"
            isAuthenticated={false}
            onHomePress={onHomePress}
            onWishlistPress={() => {}} // Already on wishlist
            onSellPress={onSellPress}
            onMessagesPress={onMessagesPress}
            onLoginPress={onLoginPress}
          />
        </Column>
      </Column>
    );
  }

  return (
    <Column flex={1} backgroundColor="$background">
      {/* Header */}
      <Column
        paddingTop={insets.top + 16}
        paddingHorizontal="$4"
        paddingBottom="$4"
        backgroundColor="$background"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Row alignItems="center" gap="$3">
          {onBack && (
            <Column
              onPress={onBack}
              padding="$2"
              borderRadius="$full"
              pressStyle={{ opacity: 0.7 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color="$text" />
            </Column>
          )}
          <Heading level={2} color="$text">
            My Favourites
          </Heading>
        </Row>
      </Column>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 100, // Account for bottom nav
        }}
      >
        {/* Loading State */}
        {loading && (
          <Column alignItems="center" paddingVertical="$8">
            <Spinner size="lg" color="$primary" />
            <Text marginTop="$4" color="$textSecondary">
              Loading your favourites...
            </Text>
          </Column>
        )}

        {/* Error State */}
        {error && !loading && (
          <Column
            alignItems="center"
            paddingVertical="$6"
            backgroundColor="$errorLight"
            borderRadius="$md"
            padding="$4"
          >
            <Text color="$error" fontWeight="600" size="$5">
              Error
            </Text>
            <Text marginTop="$2" color="$error" textAlign="center">
              {error}
            </Text>
          </Column>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <Column alignItems="center" paddingVertical="$8" gap="$4">
            <Heart size={80} color="$border" />
            <Heading level={3} color="$text" textAlign="center">
              No favourites yet
            </Heading>
            <Text size="$5" color="$textSecondary" textAlign="center" paddingHorizontal="$4">
              Browse our marketplace to discover amazing golf equipment and save your favourites
              here.
            </Text>
            <Button butterVariant="primary" size="$5" marginTop="$4" onPress={onBrowseListings}>
              Browse Listings
            </Button>
          </Column>
        )}

        {/* Products List */}
        {!loading && !error && products.length > 0 && (
          <Column gap="$4">
            <Text size="$5" color="$textSecondary">
              {products.length === 1 ? "1 item saved" : `${products.length} items saved`}
            </Text>

            {products.map((product) => (
              <FavouriteProductCard
                key={product.id}
                product={product}
                onView={() => onViewProduct?.(product.id)}
                onBuyNow={() => onBuyNow?.(product.id)}
                onMakeOffer={() => onMakeOffer?.(product.id)}
                onRemove={() => handleRemove(product.id)}
                isRemoving={removingId === product.id}
              />
            ))}
          </Column>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <Column position="absolute" bottom={0} left={0} right={0} zIndex={100}>
        <MobileBottomNav
          activeTab="wishlist"
          isAuthenticated={isAuthenticated}
          onHomePress={onHomePress}
          onWishlistPress={() => {}} // Already on wishlist
          onSellPress={onSellPress}
          onMessagesPress={onMessagesPress}
          onLoginPress={onLoginPress}
          onAccountPress={onAccountPress}
        />
      </Column>
    </Column>
  );
}

// Individual favourite product card component
interface FavouriteProductCardProps {
  product: FavouriteProduct;
  onView?: () => void;
  onBuyNow?: () => void;
  onMakeOffer?: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
}

function FavouriteProductCard({
  product,
  onView,
  onBuyNow,
  onMakeOffer,
  onRemove,
  isRemoving = false,
}: Readonly<FavouriteProductCardProps>) {
  return (
    <Column
      backgroundColor="$surface"
      borderRadius="$lg"
      padding="$3"
      gap="$3"
      shadowColor="rgba(0, 0, 0, 0.08)"
      shadowOffset={{ width: 0, height: 2 }}
      shadowRadius={8}
      elevation={2}
      opacity={isRemoving ? 0.5 : 1}
    >
      {/* Image and Info Row */}
      <Row gap="$3" alignItems="flex-start">
        {/* Product Image - 4:3 aspect ratio (120x90) */}
        <Column
          onPress={onView}
          pressStyle={{ opacity: 0.9 }}
          accessibilityRole="button"
          accessibilityLabel={`View ${product.title}`}
          width={120}
          height={90}
          borderRadius="$md"
          overflow="hidden"
          backgroundColor="$border"
        >
          <Image
            source={{ uri: product.imageUrl || PLACEHOLDER_IMAGE_URL }}
            alt={product.title}
            width={120}
            height={90}
            resizeMode={product.imageUrl ? "cover" : "contain"}
          />
        </Column>

        {/* Product Info */}
        <Column flex={1} gap="$1">
          <Column
            onPress={onView}
            pressStyle={{ opacity: 0.9 }}
            accessibilityRole="button"
            accessibilityLabel={`View ${product.title}`}
          >
            <Text size="$5" fontWeight="600" color="$text" numberOfLines={2}>
              {product.title}
            </Text>
          </Column>

          <Text size="$3" color="$textSecondary">
            {product.category || "Uncategorized"}
          </Text>

          <Text size="$6" fontWeight="700" color="$primary" marginTop="$1">
            £{product.price.toFixed(2)}
          </Text>

          {/* Seller Info */}
          <Row gap="$1" alignItems="center" marginTop="$1">
            <Text size="$3" color="$textSecondary">
              {product.seller.firstName || "Seller"}
            </Text>
            {product.seller.ratingCount > 0 && (
              <>
                <Text size="$3" color="$textSecondary">
                  •
                </Text>
                <Text size="$3" color="$primary">
                  ★ {product.seller.averageRating?.toFixed(1)}
                </Text>
              </>
            )}
          </Row>
        </Column>

        {/* Remove Button */}
        <Column
          onPress={onRemove}
          padding="$2"
          borderRadius="$full"
          backgroundColor="$border"
          pressStyle={{ opacity: 0.7, backgroundColor: "$errorLight" }}
          disabled={isRemoving}
          accessibilityRole="button"
          accessibilityLabel="Remove from favourites"
        >
          <Trash2 size={20} color="$error" />
        </Column>
      </Row>

      {/* Action Buttons */}
      <Row gap="$3">
        <Button flex={1} butterVariant="primary" size="$4" onPress={onBuyNow}>
          Buy Now
        </Button>
        <Button flex={1} butterVariant="dark" size="$4" onPress={onMakeOffer}>
          Make Offer
        </Button>
      </Row>
    </Column>
  );
}
