"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Column, Row, Text, Heading, Button, View, Card } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart } from "@tamagui/lucide-icons";
import { ProductCard } from "@/components/ProductCard";
import { Pagination } from "@/components/Pagination";
import { useLinkPress } from "@/hooks/useLinkPress";
import { SortDropdown } from "@/app/listings/_components/SortDropdown";
import { CardGrid, SECTION_MAX_WIDTH } from "@/app/_components/marketplace/Section";
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
  { value: "recent", label: "Recently added" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-az", label: "Name: A–Z" },
];

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
      backgroundColor="$backgroundHover"
      borderRadius="$lg"
      position="relative"
      overflow="hidden"
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FavouritesClient() {
  const router = useRouter();
  const linkPress = useLinkPress();
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

  const hasProducts = !loading && !error && products.length > 0;
  const countLabel = loading
    ? "Loading your saved items…"
    : totalCount === 1
      ? "1 saved item"
      : `${totalCount} saved items`;

  return (
    <>
      <Column
        width="100%"
        maxWidth={SECTION_MAX_WIDTH}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        paddingTop="$lg"
        paddingBottom="$2xl"
        gap="$lg"
        minHeight={480}
        $gtMd={{ paddingHorizontal: "$xl", paddingTop: "$xl", paddingBottom: "$3xl" }}
      >
        {/* Title row */}
        <Row alignItems="flex-end" justifyContent="space-between" flexWrap="wrap" gap="$md">
          <Column gap="$xs">
            <Heading level={1} size="$8" color="$text">
              Favourites
            </Heading>
            <Text size="$4" color="$textSecondary" aria-live="polite">
              {countLabel}
            </Text>
          </Column>
          {hasProducts && (
            <SortDropdown
              value={sort}
              onChange={handleSortChange}
              options={FAVOURITES_SORT_OPTIONS}
            />
          )}
        </Row>

        {/* Loading */}
        {loading && (
          <CardGrid maxColumns={4}>
            {Array.from({ length: 8 }, (_, i) => (
              <LoadingSkeleton key={`skeleton-${i}`} />
            ))}
          </CardGrid>
        )}

        {/* Error */}
        {error && !loading && (
          <Card variant="outlined" padding="$xl" borderColor="$error" role="alert">
            <Column alignItems="center" gap="$sm" paddingVertical="$lg">
              <Text color="$text" fontWeight="600" size="$6">
                Something went wrong
              </Text>
              <Text color="$textSecondary" size="$4" textAlign="center">
                {error}
              </Text>
              <Button
                butterVariant="secondary"
                size="$4"
                marginTop="$sm"
                onPress={() => globalThis.location.reload()}
              >
                Try again
              </Button>
            </Column>
          </Card>
        )}

        {/* Empty */}
        {!loading && !error && products.length === 0 && (
          <Column alignItems="center" justifyContent="center" paddingVertical="$3xl" gap="$lg">
            <View
              width={88}
              height={88}
              borderRadius="$full"
              backgroundColor="$primaryLight"
              alignItems="center"
              justifyContent="center"
            >
              <Heart size={40} color="$primary" strokeWidth={1.5} />
            </View>

            <Column alignItems="center" gap="$xs" maxWidth={420}>
              <Heading level={2} size="$6" color="$text" textAlign="center">
                No favourites yet
              </Heading>
              <Text size="$4" color="$textSecondary" textAlign="center">
                Save items you love by tapping the heart icon. They&apos;ll appear here so you can
                find them easily.
              </Text>
            </Column>

            <Button
              butterVariant="primary"
              size="$5"
              tag="a"
              href="/listings"
              onPress={linkPress("/listings")}
            >
              Browse listings
            </Button>
          </Column>
        )}

        {/* Grid */}
        {hasProducts && (
          <>
            <CardGrid maxColumns={4}>
              {sortedProducts.map((product) => (
                <View
                  key={product.id}
                  style={{
                    opacity: removingIds.has(product.id) ? 0 : 1,
                    transform: removingIds.has(product.id) ? "scale(0.95)" : "scale(1)",
                    transition: "opacity 250ms ease-out, transform 250ms ease-out",
                  }}
                >
                  <ProductCard product={product} />
                </View>
              ))}
            </CardGrid>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </Column>

      {/* Undo toast */}
      {undoProduct && (
        <View
          role="status"
          style={{ position: "fixed", bottom: 24, left: "50%", zIndex: 9999 }}
          animation="medium"
          enterStyle={{ opacity: 0, y: 10 }}
          opacity={1}
          y={0}
          x="-50%"
        >
          <Card variant="elevated" padding="$sm" backgroundColor="$secondary" borderRadius="$full">
            <Row alignItems="center" gap="$md" paddingLeft="$sm">
              <Text size="$4" color="$textInverse" fontWeight="500">
                Removed from favourites
              </Text>
              <Button butterVariant="secondary" size="$3" onPress={handleUndo}>
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
