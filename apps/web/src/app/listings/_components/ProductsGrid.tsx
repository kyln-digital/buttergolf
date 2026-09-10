"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Column, View, Text } from "@buttergolf/ui";
import { ProductCard } from "@/components/ProductCard";
import { Pagination } from "@/components/Pagination";
import { CardGrid } from "@/app/_components/marketplace/Section";
import type { ProductCardData } from "@buttergolf/app";

interface ProductsGridProps {
  readonly products: ProductCardData[];
  readonly isLoading: boolean;
  readonly isPaginating?: boolean; // When paginating, keep products visible with fade transition
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  readonly onClearFilters?: () => void;
}

/** Same footprint as a card: 4:3 image plus the text block. */
function LoadingSkeleton() {
  return (
    <Column
      width="100%"
      paddingBottom="111.11%"
      backgroundColor="$backgroundHover"
      borderRadius="$lg"
      position="relative"
      overflow="hidden"
      aria-hidden
    />
  );
}

/**
 * Animated wrapper for grid content with fade/slide transitions
 */
function AnimatedGridContent({
  products,
  isLoading,
  isPaginating,
  currentPage,
}: Readonly<{
  products: ProductCardData[];
  isLoading: boolean;
  isPaginating: boolean;
  currentPage: number;
}>) {
  const [displayProducts, setDisplayProducts] = useState(products);
  const prevPageRef = useRef(currentPage);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle page transitions with animation
  useEffect(() => {
    // When paginating (not loading), animate the transition
    if (isPaginating && prevPageRef.current !== currentPage) {
      // Determine slide direction based on page change
      setSlideDirection(currentPage > prevPageRef.current ? "left" : "right"); // eslint-disable-line react-hooks/set-state-in-effect
      setIsAnimating(true);
      prevPageRef.current = currentPage;
    }
  }, [isPaginating, currentPage]);

  // When we get new products and we're done paginating, fade them in
  useEffect(() => {
    if (!isPaginating && !isLoading && products !== displayProducts) {
      // Small delay to allow exit animation
      const timer = setTimeout(
        () => {
          setDisplayProducts(products);
          setIsAnimating(false);
        },
        isAnimating ? 200 : 0
      );
      return () => clearTimeout(timer);
    }
  }, [products, isPaginating, isLoading, displayProducts, isAnimating]);

  // Show loading skeletons only for full loading (filter changes), not pagination
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <LoadingSkeleton key={`loading-skeleton-${i}`} />
        ))}
      </>
    );
  }

  // During pagination, show current products with fade effect
  const productsToShow = isPaginating ? displayProducts : products;

  return (
    <>
      {productsToShow.map((product, index) => (
        <View
          key={product.id}
          style={{
            opacity: isPaginating || isAnimating ? 0.5 : 1,
            transform: isPaginating
              ? slideDirection === "left"
                ? "translateX(-8px)"
                : "translateX(8px)"
              : "translateX(0)",
            transition: "opacity 200ms ease-out, transform 200ms ease-out",
            transitionDelay: `${Math.min(index * 8, 150)}ms`,
          }}
        >
          <ProductCard product={product} />
        </View>
      ))}
    </>
  );
}

export function ProductsGrid({
  products,
  isLoading,
  isPaginating = false,
  currentPage,
  totalPages,
  onPageChange,
  onClearFilters,
}: Readonly<ProductsGridProps>) {
  if (!isLoading && !isPaginating && products.length === 0) {
    return (
      <Column
        alignItems="center"
        justifyContent="center"
        paddingVertical="$3xl"
        paddingHorizontal="$md"
        gap="$md"
        role="status"
      >
        <Column alignItems="center" gap="$xs">
          <Text size="$7" fontWeight="600" color="$text" textAlign="center">
            No products found
          </Text>
          <Text size="$4" color="$textSecondary" textAlign="center">
            Try adjusting your filters or search query
          </Text>
        </Column>
        {onClearFilters && (
          <Button butterVariant="secondary" size="$4" onPress={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </Column>
    );
  }

  return (
    <Column gap="$md" width="100%" aria-busy={isLoading || isPaginating}>
      <CardGrid maxColumns={4}>
        <AnimatedGridContent
          products={products}
          isLoading={isLoading}
          isPaginating={isPaginating}
          currentPage={currentPage}
        />
      </CardGrid>

      {!isLoading && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          disabled={isPaginating}
        />
      )}
    </Column>
  );
}
