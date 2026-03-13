"use client";

import { useState, useEffect, useRef } from "react";
import { Column, View, Text } from "@buttergolf/ui";
import { ProductCard } from "@/components/ProductCard";
import { DotPagination } from "@/components/DotPagination";
import type { ProductCardData } from "@buttergolf/app";
import { useRouter } from "next/navigation";

interface ProductsGridProps {
  readonly products: ProductCardData[];
  readonly isLoading: boolean;
  readonly isPaginating?: boolean; // When paginating, keep products visible with fade transition
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

function LoadingSkeleton() {
  return (
    <Column
      width="100%"
      paddingBottom="111.11%"
      backgroundColor="$border"
      borderRadius="$lg"
      position="relative"
      overflow="hidden"
      transition="quick"
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
  const router = useRouter();
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
        {Array.from({ length: 24 }, (_, i) => (
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
          <ProductCard product={product} onPress={() => router.push(`/products/${product.id}`)} />
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
}: Readonly<ProductsGridProps>) {
  if (!isLoading && !isPaginating && products.length === 0) {
    return (
      <Column alignItems="center" justifyContent="center" paddingVertical="$10" gap="$md">
        <Text size="$7" weight="semibold" color="$textSecondary">
          No products found
        </Text>
        <Text color="$text">Try adjusting your filters or search query</Text>
      </Column>
    );
  }

  return (
    <Column gap="$lg" width="100%">
      {/* Products Grid - Responsive: 2 col mobile, 3 col tablet, 4 col desktop */}
      <Column
        width="100%"
        style={{ display: "grid" }}
        gridTemplateColumns="repeat(2, 1fr)"
        gap="$md"
        $sm={{
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "$lg",
        }}
        $md={{
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        <AnimatedGridContent
          products={products}
          isLoading={isLoading}
          isPaginating={isPaginating}
          currentPage={currentPage}
        />
      </Column>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <DotPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          disabled={isPaginating}
        />
      )}
    </Column>
  );
}
