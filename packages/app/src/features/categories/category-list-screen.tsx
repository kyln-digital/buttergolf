"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Column, Row, ScrollView, Text, Spinner } from "@buttergolf/ui";
import { ProductCard } from "../../components/ProductCard";
import type { ProductCardData } from "../../types/product";
import { useLink } from "solito/navigation";
import { routes } from "../../navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MobileCategoryHeader,
  MobileBottomNav,
  MobileFilterSheet,
  type FilterState,
} from "../../components/mobile";

interface CategoryListScreenProps {
  categorySlug: string;
  categoryName: string;
  onFetchProducts?: (categorySlug: string) => Promise<ProductCardData[]>;
  onBack?: () => void;
  onFilter?: () => void;
  onSellPress?: () => void;
  onLoginPress?: () => void;
  onAccountPress?: () => void;
  onHomePress?: () => void;
  onWishlistPress?: () => void;
  onMessagesPress?: () => void;
  isAuthenticated?: boolean;
  /** Favourites - Set of product IDs that are favourited */
  favourites?: Set<string>;
  /** Callback when favourite is toggled */
  onToggleFavourite?: (productId: string) => Promise<{ success: boolean; requiresAuth?: boolean }>;
  /** Callback when product is pressed - use on mobile to avoid useLink navigation issues */
  onProductPress?: (productId: string) => void;
}

export function CategoryListScreen({
  categorySlug,
  categoryName,
  onFetchProducts,
  onBack,
  onFilter,
  onSellPress,
  onLoginPress,
  onAccountPress,
  onHomePress,
  onWishlistPress,
  onMessagesPress,
  isAuthenticated = false,
  favourites = new Set(),
  onToggleFavourite,
  onProductPress,
}: Readonly<CategoryListScreenProps>) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    conditions: [],
    minPrice: null,
    maxPrice: null,
    sortBy: "newest",
  });

  useEffect(() => {
    if (onFetchProducts) {
      setLoading(true);
      onFetchProducts(categorySlug)
        .then((fetchedProducts) => {
          console.log(`Fetched ${fetchedProducts.length} products for ${categorySlug}`);
          setProducts(fetchedProducts);
        })
        .catch((error) => {
          console.error("Failed to fetch products:", error);
        })
        .finally(() => setLoading(false));
    }
  }, [categorySlug, onFetchProducts]);

  // Handle filter button press
  const handleFilterPress = useCallback(() => {
    setFilterSheetVisible(true);
    onFilter?.();
  }, [onFilter]);

  // Handle applying filters
  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Handle clearing filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      conditions: [],
      minPrice: null,
      maxPrice: null,
      sortBy: "newest",
    });
  }, []);

  // Handle favourite toggle
  const handleFavouriteToggle = useCallback(
    async (productId: string) => {
      if (!onToggleFavourite) {
        // If no handler provided and not authenticated, prompt login
        if (!isAuthenticated && onLoginPress) {
          onLoginPress();
        }
        return;
      }

      const result = await onToggleFavourite(productId);
      if (result.requiresAuth && onLoginPress) {
        onLoginPress();
      }
    },
    [onToggleFavourite, isAuthenticated, onLoginPress]
  );

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Apply search query filter
    if (searchQuery) {
      result = result.filter((product) =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply condition filter
    if (filters.conditions.length > 0) {
      result = result.filter(
        (product) => product.condition && filters.conditions.includes(product.condition)
      );
    }

    // Apply price range filter
    if (filters.minPrice !== null) {
      result = result.filter((product) => product.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
      result = result.filter((product) => product.price <= filters.maxPrice!);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case "price_low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        // Assuming products are already sorted by newest from API
        break;
    }

    return result;
  }, [products, searchQuery, filters]);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    return (
      filters.conditions.length +
      (filters.minPrice !== null ? 1 : 0) +
      (filters.maxPrice !== null ? 1 : 0) +
      (filters.sortBy !== "newest" ? 1 : 0)
    );
  }, [filters]);

  return (
    <Column flex={1} backgroundColor="$background">
      {/* Sticky Category Header - Fixed at top */}
      <Column position="absolute" top={0} left={0} right={0} zIndex={100}>
        <Column
          backgroundColor="$background"
          borderBottomLeftRadius="$2xl"
          borderBottomRightRadius="$2xl"
          shadowColor="rgba(0, 0, 0, 0.15)"
          shadowOffset={{ width: 0, height: 4 }}
          shadowOpacity={1}
          shadowRadius={8}
          elevation={8}
        >
          <MobileCategoryHeader
            categoryName={categoryName}
            onBackPress={onBack}
            onFilterPress={handleFilterPress}
            onSearch={setSearchQuery}
            placeholder={`Search in ${categoryName}...`}
          />
        </Column>
      </Column>

      {/* Filter Sheet */}
      <MobileFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 90, // Account for sticky header (search bar only)
          paddingBottom: insets.bottom + 80, // Account for bottom nav
          paddingHorizontal: 16,
        }}
      >
        {/* Active filter count indicator */}
        {activeFilterCount > 0 && (
          <Row
            marginBottom="$3"
            paddingHorizontal="$3"
            paddingVertical="$2"
            backgroundColor="$primaryLight"
            borderRadius="$md"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text size="$4" color="$primary" fontWeight="500">
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
            </Text>
            <Text size="$4" color="$primary" fontWeight="600" onPress={handleClearFilters}>
              Clear
            </Text>
          </Row>
        )}

        {loading ? (
          <Column padding="$8" alignItems="center">
            <Spinner size="lg" color="$primary" />
            <Text marginTop="$4" color="$textSecondary">
              Loading products...
            </Text>
          </Column>
        ) : filteredProducts.length === 0 ? (
          <Column padding="$8" alignItems="center">
            <Text size="$6" color="$textSecondary" textAlign="center">
              {searchQuery || activeFilterCount > 0
                ? "No products match your filters"
                : `No products available in ${categoryName}`}
            </Text>
            {activeFilterCount > 0 && (
              <Text
                size="$5"
                color="$primary"
                fontWeight="600"
                marginTop="$3"
                onPress={handleClearFilters}
              >
                Clear filters
              </Text>
            )}
          </Column>
        ) : (
          /* 2-column grid */
          <Column gap="$4">
            {Array.from({ length: Math.ceil(filteredProducts.length / 2) }).map((_, rowIndex) => (
              <Row key={rowIndex} gap="$4">
                {filteredProducts.slice(rowIndex * 2, rowIndex * 2 + 2).map((product) => (
                  <Column key={product.id} flex={1}>
                    <ProductCardWithLink
                      product={product}
                      isFavourited={favourites.has(product.id)}
                      onFavourite={handleFavouriteToggle}
                      onProductPress={onProductPress}
                    />
                  </Column>
                ))}
                {/* Add empty column if odd number of products in last row */}
                {rowIndex === Math.ceil(filteredProducts.length / 2) - 1 &&
                  filteredProducts.length % 2 !== 0 && <Column flex={1} />}
              </Row>
            ))}
          </Column>
        )}
      </ScrollView>

      {/* Bottom Navigation - Fixed at bottom */}
      <Column position="absolute" bottom={0} left={0} right={0} zIndex={100}>
        <MobileBottomNav
          activeTab="home"
          isAuthenticated={isAuthenticated}
          onHomePress={onHomePress}
          onWishlistPress={onWishlistPress}
          onSellPress={onSellPress}
          onMessagesPress={onMessagesPress}
          onLoginPress={onLoginPress}
          onAccountPress={onAccountPress}
        />
      </Column>
    </Column>
  );
}

// Helper component to attach navigation to ProductCard
// Uses onProductPress callback when provided (mobile), falls back to Solito link (web)
function ProductCardWithLink({
  product,
  isFavourited,
  onFavourite,
  onProductPress,
}: Readonly<{
  product: ProductCardData;
  isFavourited?: boolean;
  onFavourite?: (productId: string) => void;
  onProductPress?: (productId: string) => void;
}>) {
  // On mobile, use the callback prop to avoid useLink navigation context issues
  if (onProductPress) {
    return (
      <ProductCard
        product={product}
        onPress={() => onProductPress(product.id)}
        isFavourited={isFavourited}
        onFavourite={onFavourite}
      />
    );
  }

  // On web, use Solito's useLink for proper routing
  return (
    <ProductCardWithSolitoLink
      product={product}
      isFavourited={isFavourited}
      onFavourite={onFavourite}
    />
  );
}

// Separate component for web that uses Solito's useLink
// Keeping hooks unconditional by isolating them in a separate component
function ProductCardWithSolitoLink({
  product,
  isFavourited,
  onFavourite,
}: Readonly<{
  product: ProductCardData;
  isFavourited?: boolean;
  onFavourite?: (productId: string) => void;
}>) {
  const linkProps = useLink({
    href: routes.productDetail.replace("[id]", product.id),
  });

  return (
    <ProductCard
      product={product}
      onPress={linkProps.onPress}
      isFavourited={isFavourited}
      onFavourite={onFavourite}
    />
  );
}
