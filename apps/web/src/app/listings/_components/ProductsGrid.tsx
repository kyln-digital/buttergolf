"use client";

import { useState, useEffect, useRef } from "react";
import { Column, Row, View, Text } from "@buttergolf/ui";
import { ProductCard } from "@/components/ProductCard";
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
      animation="quick"
    />
  );
}

/**
 * Dot-based pagination component
 * - Matches the ProductCarousel pagination dots styling
 * - Active dot is elongated pill (48px), inactive is circle (10px)
 * - Uses CSS transitions for smooth animations (same as carousel)
 */
function DotPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: Readonly<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}>) {
  // For many pages, show limited dots with the active one in context
  const getVisiblePages = (): number[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Show: current-2, current-1, current, current+1, current+2
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <Row alignItems="center" justifyContent="center" gap="$sm" paddingVertical="$xl">
      {visiblePages.map((page) => {
        const isActive = page === currentPage;

        return (
          <button
            key={page}
            onClick={() => !disabled && onPageChange(page)}
            disabled={disabled}
            aria-label={`Go to page ${page}`}
            aria-current={isActive ? "page" : undefined}
            style={{
              // Match ProductCarousel dot styling exactly
              width: isActive ? "48px" : "10px",
              height: "10px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: isActive
                ? "#F45314"
                : disabled
                  ? "rgba(244, 83, 20, 0.3)"
                  : "rgba(244, 83, 20, 0.5)",
              cursor: disabled ? "wait" : "pointer",
              transition: "all 0.3s ease",
              padding: 0,
              opacity: disabled && !isActive ? 0.6 : 1,
            }}
          />
        );
      })}
    </Row>
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
        <Text color="$textMuted">Try adjusting your filters or search query</Text>
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
