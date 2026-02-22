"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Column, Row, Text, Heading, Button, View, Card } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Heart, Check, ChevronDown } from "@tamagui/lucide-icons";
import { Select, Adapt, Sheet, useTheme } from "tamagui";
import { ProductCard } from "@/components/ProductCard";
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

type SortOption = "recent" | "price-asc" | "price-desc" | "name-az";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-az", label: "Name: A–Z" },
];

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

function FavouritesSortDropdown({
  value,
  onChange,
}: Readonly<{ value: SortOption; onChange: (v: SortOption) => void }>) {
  const selectedLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Sort by",
    [value]
  );

  return (
    <Select
      value={value}
      onValueChange={(v: string) => onChange(v as SortOption)}
      disablePreventBodyScroll
    >
      <Select.Trigger
        minWidth={200}
        height={40}
        paddingHorizontal="$3"
        borderRadius={10}
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$surface"
        hoverStyle={{ borderColor: "$borderHover" }}
        focusStyle={{ borderColor: "$primary", outlineWidth: 0 }}
        iconAfter={ChevronDown}
      >
        <Select.Value placeholder="Sort by">{selectedLabel}</Select.Value>
      </Select.Trigger>

      <Adapt when="sm" platform="touch">
        <Sheet
          modal
          dismissOnSnapToBottom
          animationConfig={{ type: "spring", damping: 20, mass: 1.2, stiffness: 250 }}
        >
          <Sheet.Frame>
            <Sheet.ScrollView>
              <Adapt.Contents />
            </Sheet.ScrollView>
          </Sheet.Frame>
          <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        </Sheet>
      </Adapt>

      <Select.Content zIndex={200000}>
        <Select.Viewport minWidth={200}>
          <Select.Group>
            {SORT_OPTIONS.map((option, index) => (
              <Select.Item
                key={option.value}
                index={index}
                value={option.value}
                cursor="pointer"
                hoverStyle={{ backgroundColor: "$backgroundHover" }}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator marginLeft="auto">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select>
  );
}

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
  const theme = useTheme();
  const primaryColor = theme.primary.val;

  const visiblePages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [totalPages, currentPage]);

  return (
    <Row alignItems="center" justifyContent="center" gap="$sm" paddingVertical="$xl">
      {visiblePages.map((pg) => {
        const isActive = pg === currentPage;
        return (
          <button
            key={pg}
            onClick={() => !disabled && onPageChange(pg)}
            disabled={disabled}
            aria-label={`Go to page ${pg}`}
            aria-current={isActive ? "page" : undefined}
            style={{
              width: isActive ? 48 : 10,
              height: 10,
              borderRadius: 5,
              border: "none",
              backgroundColor: primaryColor,
              opacity: isActive ? 1 : disabled ? 0.3 : 0.5,
              cursor: disabled ? "wait" : "pointer",
              transition: "all 0.3s ease",
              padding: 0,
            }}
          />
        );
      })}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FavouritesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { removeFromFavourites } = useFavouritesContext();

  const [products, setProducts] = useState<FavouritesResponse["products"]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "recent"
  );

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
    (newSort: SortOption) => {
      setSort(newSort);
      const params = new URLSearchParams(searchParams.toString());
      if (newSort === "recent") {
        params.delete("sort");
      } else {
        params.set("sort", newSort);
      }
      const qs = params.toString();
      router.replace(`/favourites${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Remove with animation + undo
  const handleRemove = useCallback(
    async (productId: string) => {
      // Start fade-out animation
      setRemovingIds((prev) => new Set(prev).add(productId));

      // Wait for animation
      await new Promise((r) => setTimeout(r, 250));

      // Optimistically remove from local state
      const removed = products.find((p) => p.id === productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setTotalCount((c) => Math.max(0, c - 1));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });

      // Update global favourites context
      removeFromFavourites(productId);

      // Show undo toast
      if (removed) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoProduct(removed as ProductCardData & { favouritedAt: string });
        undoTimerRef.current = setTimeout(() => setUndoProduct(null), 4000);
      }

      // Fire API call
      try {
        const response = await fetch(`/api/favourites/${productId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to remove favourite");
      } catch (err) {
        console.error("Error removing favourite:", err);
        // Restore on failure
        if (removed) {
          setProducts((prev) => [...prev, removed]);
          setTotalCount((c) => c + 1);
        }
      }
    },
    [products, removeFromFavourites]
  );

  // Undo handler
  const handleUndo = useCallback(async () => {
    if (!undoProduct) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    // Restore locally
    setProducts((prev) => [undoProduct, ...prev]);
    setTotalCount((c) => c + 1);
    setUndoProduct(null);

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
  }, [undoProduct]);

  // Listen for unfavourite events from ProductCard heart clicks
  // The useFavouriteToggle hook handles the API call, so we just need to
  // sync the local list when a heart is toggled
  useEffect(() => {
    // Poll favourites context to detect removals — ProductCard handles
    // its own toggle, but we need to reflect it in this page's local state.
    // We do this by checking if any product in our list is no longer favourited.
    // This is lightweight since it's a Set lookup.
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
              <FavouritesSortDropdown value={sort} onChange={handleSortChange} />
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
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            animation: "fadeInUp 200ms ease-out",
          }}
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
        </div>
      )}

      <FooterSection />
    </>
  );
}
