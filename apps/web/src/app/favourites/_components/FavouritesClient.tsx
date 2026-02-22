"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Column, Row, Text, Heading, Button, View, Card } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Heart } from "@tamagui/lucide-icons";
import { ProductCard } from "@/components/ProductCard";
import { DotPagination } from "@/components/DotPagination";
import { SortDropdown } from "@/app/listings/_components/SortDropdown";
import { useFavouritesContext } from "@/providers/FavouritesProvider";
import { FooterSection } from "../../_components/marketplace/FooterSection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FavouritesResponse {
  products: Array<ProductCardData & { favouritedAt: string; description?: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const FAVOURITES_SORT_OPTIONS = [
  { value: "recent", label: "Recently Added" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-az", label: "Name: A–Z" },
] as const;

const VALID_SORT_VALUES = new Set(FAVOURITES_SORT_OPTIONS.map((o) => o.value));

function validSort(value: string | null): string {
  return value && VALID_SORT_VALUES.has(value) ? value : "recent";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FavouritesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    addToFavourites,
    isFavourited: isGloballyFavourited,
    loading: contextLoading,
  } = useFavouritesContext();

  const [products, setProducts] = useState<FavouritesResponse["products"]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState(() => validSort(searchParams.get("sort")));

  // Sync sort state when URL changes via back/forward navigation
  useEffect(() => {
    const paramSort = validSort(searchParams.get("sort"));
    setSort(paramSort);
  }, [searchParams]);

  // Track items being removed (for fade-out animation)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Undo state
  const [undoProduct, setUndoProduct] = useState<
    (ProductCardData & { favouritedAt: string }) | null
  >(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch favourites
  useEffect(() => {
    let cancelled = false;

    async function fetchFavourites() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/favourites?page=${page}&limit=24`);

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/sign-in?redirect_url=/favourites");
            return;
          }
          throw new Error("Failed to fetch favourites");
        }

        const data: FavouritesResponse = await response.json();
        if (!cancelled) {
          setProducts(data.products);
          setTotalCount(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching favourites:", err);
          setError(err instanceof Error ? err.message : "Failed to load favourites");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFavourites();
    return () => {
      cancelled = true;
    };
  }, [page, router]);

  // Sync local list when a heart is toggled via ProductCard's useFavouriteToggle.
  // When the global favourites Set drops a product we still show, animate it out.
  // Gate on contextLoading to avoid false-positive removals while the Set is empty.
  useEffect(() => {
    if (loading || contextLoading || products.length === 0) return;

    const removalTimeouts: ReturnType<typeof setTimeout>[] = [];

    const unfavouritedProducts = products.filter(
      (p) => !isGloballyFavourited(p.id) && !removingIds.has(p.id)
    );

    for (const product of unfavouritedProducts) {
      // Trigger animated removal (useFavouriteToggle already made the DELETE request).
      setRemovingIds((prev) => new Set(prev).add(product.id));

      // Show undo toast for the most recently removed item
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoProduct(product);
      undoTimerRef.current = setTimeout(() => {
        setUndoProduct(null);
      }, 4000);

      const timeout = setTimeout(() => {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setTotalCount((c) => Math.max(0, c - 1));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 250);
      removalTimeouts.push(timeout);
    }

    return () => {
      removalTimeouts.forEach(clearTimeout);
    };
  }, [isGloballyFavourited, loading, contextLoading, products, removingIds]);

  // Client-side sort
  const sortedProducts = useMemo(() => {
    const items = [...products];
    switch (sort) {
      case "price-asc":
        return items.sort((a, b) => a.price - b.price);
      case "price-desc":
        return items.sort((a, b) => b.price - a.price);
      case "name-az":
        return items.sort((a, b) => a.title.localeCompare(b.title));
      case "recent":
      default:
        return items.sort(
          (a, b) => new Date(b.favouritedAt).getTime() - new Date(a.favouritedAt).getTime()
        );
    }
  }, [products, sort]);

  // Update URL when sort changes
  const handleSortChange = useCallback(
    (newSort: string) => {
      const validated = validSort(newSort);
      setSort(validated);
      const params = new URLSearchParams(searchParams.toString());
      if (validated === "recent") {
        params.delete("sort");
      } else {
        params.set("sort", validated);
      }
      const qs = params.toString();
      router.replace(`/favourites${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Undo handler
  const handleUndo = useCallback(async () => {
    if (!undoProduct) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    // Restore locally
    setProducts((prev) => [undoProduct, ...prev]);
    setTotalCount((c) => c + 1);
    setUndoProduct(null);

    // Re-add in global favourites context
    addToFavourites(undoProduct.id);

    // Re-add via API
    try {
      await fetch("/api/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: undoProduct.id }),
      });
    } catch (err) {
      console.error("Error restoring favourite:", err);
    }
  }, [undoProduct, addToFavourites]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* Header Section */}
      <Column
        backgroundColor="$background"
        paddingVertical="$2xl"
        paddingHorizontal="$lg"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Column maxWidth={1400} marginHorizontal="auto" gap="$sm" width="100%">
          <Heading level={1} color="$text">
            My Favourites
          </Heading>
          <Text size="$5" color="$textSecondary">
            Your saved golf equipment — ready when you are.
          </Text>
        </Column>
      </Column>

      {/* Main Content */}
      <Column
        maxWidth={1400}
        marginHorizontal="auto"
        paddingHorizontal="$lg"
        paddingVertical="$xl"
        gap="$lg"
        minHeight={400}
      >
        {/* Loading State — skeleton grid */}
        {loading && (
          <Column gap="$lg" width="100%">
            {/* Summary bar skeleton */}
            <Row alignItems="center" justifyContent="space-between">
              <View width={160} height={28} backgroundColor="$border" borderRadius="$md" />
              <View width={200} height={40} backgroundColor="$border" borderRadius={10} />
            </Row>

            {/* Skeleton grid */}
            <Column
              width="100%"
              style={{ display: "grid" }}
              gridTemplateColumns="repeat(2, 1fr)"
              gap="$md"
              $gtSm={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "$lg" }}
              $gtMd={{ gridTemplateColumns: "repeat(4, 1fr)" }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <LoadingSkeleton key={`skeleton-${i}`} />
              ))}
            </Column>
          </Column>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card variant="outlined" padding="$xl" borderColor="$error">
            <Column alignItems="center" gap="$sm" paddingVertical="$lg">
              <Text color="$error" fontWeight="600" size="$6">
                Something went wrong
              </Text>
              <Text color="$textSecondary" size="$5" textAlign="center">
                {error}
              </Text>
              <Button
                butterVariant="primary"
                size="$4"
                marginTop="$md"
                onPress={() => globalThis.location.reload()}
              >
                Try again
              </Button>
            </Column>
          </Card>
        )}

        {/* Empty State — Branded */}
        {!loading && !error && products.length === 0 && (
          <Column
            alignItems="center"
            justifyContent="center"
            paddingVertical="$3xl"
            gap="$xl"
            animation="medium"
            enterStyle={{ opacity: 0, y: 20 }}
            opacity={1}
            y={0}
          >
            <View
              width={100}
              height={100}
              borderRadius="$full"
              backgroundColor="$primaryLight"
              alignItems="center"
              justifyContent="center"
            >
              <Heart size={48} color="$primary" strokeWidth={1.5} />
            </View>

            <Column alignItems="center" gap="$sm" maxWidth={420}>
              <Heading level={2} color="$text" textAlign="center">
                No favourites yet
              </Heading>
              <Text size="$5" color="$textSecondary" textAlign="center">
                Save items you love by tapping the heart icon. They&apos;ll appear here so you can
                find them easily.
              </Text>
            </Column>

            <Link href="/listings">
              <Button butterVariant="primary" size="$5">
                Browse Listings
              </Button>
            </Link>
          </Column>
        )}

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <>
            {/* Summary + Sort Bar */}
            <Row alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$md">
              <Text size="$6" fontWeight="600" color="$text">
                {totalCount === 1 ? "1 Favourite" : `${totalCount} Favourites`}
              </Text>
              <SortDropdown
                value={sort}
                onChange={handleSortChange}
                options={FAVOURITES_SORT_OPTIONS}
              />
            </Row>

            {/* Responsive Product Grid — 2 → 3 → 4 columns */}
            <Column
              width="100%"
              style={{ display: "grid" }}
              gridTemplateColumns="repeat(2, 1fr)"
              gap="$md"
              $gtSm={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "$lg" }}
              $gtMd={{ gridTemplateColumns: "repeat(4, 1fr)" }}
            >
              {sortedProducts.map((product) => (
                <View
                  key={product.id}
                  style={{
                    opacity: removingIds.has(product.id) ? 0 : 1,
                    transform: removingIds.has(product.id) ? "scale(0.95)" : "scale(1)",
                    transition: "opacity 250ms ease-out, transform 250ms ease-out",
                  }}
                >
                  <ProductCard
                    product={product}
                    onPress={() => router.push(`/products/${product.id}`)}
                  />
                </View>
              ))}
            </Column>

            {/* Dot Pagination */}
            {totalPages > 1 && (
              <DotPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </>
        )}
      </Column>

      {/* Undo Toast */}
      {undoProduct && (
        <View
          style={{ position: "fixed", bottom: 24, left: "50%", zIndex: 9999 }}
          animation="medium"
          enterStyle={{ opacity: 0, y: 10 }}
          opacity={1}
          y={0}
          x="-50%"
        >
          <Card variant="elevated" padding="$md" backgroundColor="$secondary" borderRadius="$lg">
            <Row alignItems="center" gap="$md">
              <Text size="$4" color="$textInverse" fontWeight="500">
                Removed from favourites
              </Text>
              <Button chromeless size="$3" color="$primary" fontWeight="700" onPress={handleUndo}>
                Undo
              </Button>
            </Row>
          </Card>
        </View>
      )}

      <FooterSection />
    </>
  );
}
