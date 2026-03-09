"use client";

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Column, Row, Text, Button, Badge, View } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { FilterSidebar, type FilterState } from "./_components/FilterSidebar";
import { MobileFilterSheet } from "./_components/MobileFilterSheet";
import { SortDropdown } from "./_components/SortDropdown";
import { ProductsGrid } from "./_components/ProductsGrid";
import { PageHero } from "../_components/marketplace/PageHero";
import { TrustSection } from "../_components/marketplace/TrustSection";
import { NewsletterSection } from "../_components/marketplace/NewsletterSection";
import { FooterSection } from "../_components/marketplace/FooterSection";

interface ListingsClientProps {
  initialProducts: ProductCardData[];
  initialTotal: number;
  initialFilters: {
    availableBrands: string[];
    priceRange: { min: number; max: number };
  };
  initialPage: number;
  /** Category slug when viewing a specific category (from /category/[slug] route) */
  initialCategory?: string | null;
}

const STORAGE_KEY = "buttergolf-listings-filters";

function areStringArraysEqual(a: readonly string[], b: readonly string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areFiltersEqual(a: FilterState | undefined, b: FilterState) {
  if (!a) return false;
  return (
    a.category === b.category &&
    a.minPrice === b.minPrice &&
    a.maxPrice === b.maxPrice &&
    a.showFavouritesOnly === b.showFavouritesOnly &&
    areStringArraysEqual(a.conditions, b.conditions) &&
    areStringArraysEqual(a.brands, b.brands)
  );
}

export function ListingsClient({
  initialProducts,
  initialTotal,
  initialFilters,
  initialPage,
  initialCategory = null,
}: Readonly<ListingsClientProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse initial filters from URL
  const getInitialFilters = (): FilterState => {
    const priceMinBound = Math.floor(initialFilters.priceRange.min);
    const priceMaxBound = Math.ceil(initialFilters.priceRange.max);

    const parseNumericParam = (value: string | null): number | undefined => {
      const parsed = Number.parseFloat(value ?? "");
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const normalisePriceRange = (
      rawMin: number | undefined,
      rawMax: number | undefined
    ): { minPrice: number; maxPrice: number } => {
      const boundedMin = Math.max(
        priceMinBound,
        Math.min(Math.floor(rawMin ?? priceMinBound), priceMaxBound)
      );
      const boundedMax = Math.max(
        priceMinBound,
        Math.min(Math.ceil(rawMax ?? priceMaxBound), priceMaxBound)
      );

      return {
        minPrice: Math.min(boundedMin, boundedMax),
        maxPrice: Math.max(boundedMin, boundedMax),
      };
    };

    // If we have an initialCategory from the route (e.g., /category/woods), use it
    // This takes precedence over localStorage and URL params for category
    const categoryFromRoute = initialCategory;
    const conditionsFromUrl = searchParams.getAll("condition");
    const brandsFromUrl = searchParams.getAll("brand");
    const minPriceFromUrl = parseNumericParam(searchParams.get("minPrice"));
    const maxPriceFromUrl = parseNumericParam(searchParams.get("maxPrice"));

    // Try to load from localStorage first
    if (globalThis.window !== undefined) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const storedConditions = Array.isArray(parsed.conditions)
            ? parsed.conditions.filter(
                (condition: unknown): condition is string => typeof condition === "string"
              )
            : [];
          const storedBrands = Array.isArray(parsed.brands)
            ? parsed.brands.filter((brand: unknown): brand is string => typeof brand === "string")
            : [];
          const storedMinPrice =
            typeof parsed.minPrice === "number"
              ? parsed.minPrice
              : parseNumericParam(String(parsed.minPrice ?? ""));
          const storedMaxPrice =
            typeof parsed.maxPrice === "number"
              ? parsed.maxPrice
              : parseNumericParam(String(parsed.maxPrice ?? ""));
          const { minPrice, maxPrice } = normalisePriceRange(
            minPriceFromUrl ?? storedMinPrice,
            maxPriceFromUrl ?? storedMaxPrice
          );

          // Merge URL params (they take precedence), but route category wins for category
          return {
            category: categoryFromRoute || searchParams.get("category") || parsed.category || null,
            conditions: conditionsFromUrl.length > 0 ? conditionsFromUrl : storedConditions,
            minPrice,
            maxPrice,
            brands: brandsFromUrl.length > 0 ? brandsFromUrl : storedBrands,
            showFavouritesOnly:
              searchParams.get("favourites") === "true" || parsed.showFavouritesOnly || false,
          };
        } catch {
          // Fall through to URL parsing
        }
      }
    }

    // Parse from URL (route category takes precedence)
    const { minPrice, maxPrice } = normalisePriceRange(minPriceFromUrl, maxPriceFromUrl);
    return {
      category: categoryFromRoute || searchParams.get("category") || null,
      conditions: conditionsFromUrl,
      minPrice,
      maxPrice,
      brands: brandsFromUrl,
      showFavouritesOnly: searchParams.get("favourites") === "true" || false,
    };
  };

  const [filters, setFilters] = useState<FilterState>(getInitialFilters());
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [products, setProducts] = useState<ProductCardData[]>(initialProducts);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false); // Separate state for pagination (no skeleton flash)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [availableFilters, setAvailableFilters] = useState(initialFilters);

  // Track if component has mounted to prevent initial fetch
  const [isMounted, setIsMounted] = useState(false);

  // Track previous filter values to detect actual changes
  const prevFiltersRef = useRef<FilterState>(filters);
  const prevSortRef = useRef<string>(sort);

  // Set mounted flag on initial mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    if (globalThis.window !== undefined) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters]);

  // Build URL from filters - uses clean category URLs for SEO
  const buildURL = useCallback(
    (newFilters: FilterState, newSort: string, newPage: number = 1) => {
      const params = new URLSearchParams();

      // Don't add category to params - it's in the URL path
      for (const c of newFilters.conditions) {
        params.append("condition", c);
      }
      if (newFilters.minPrice !== initialFilters.priceRange.min) {
        params.set("minPrice", newFilters.minPrice.toString());
      }
      if (newFilters.maxPrice !== initialFilters.priceRange.max) {
        params.set("maxPrice", newFilters.maxPrice.toString());
      }
      for (const b of newFilters.brands) {
        params.append("brand", b);
      }
      if (newFilters.showFavouritesOnly) params.set("favourites", "true");
      if (newSort !== "newest") params.set("sort", newSort);
      if (newPage > 1) params.set("page", newPage.toString());

      const queryString = params.toString();

      // Use clean category URL if a category is selected
      if (newFilters.category) {
        return queryString
          ? `/category/${newFilters.category}?${queryString}`
          : `/category/${newFilters.category}`;
      }

      // No category = /listings
      return queryString ? `/listings?${queryString}` : "/listings";
    },
    [initialFilters.priceRange]
  );

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(total / 24));

  // Fetch products with debouncing
  // isPaginationOnly: when true, don't show loading skeletons or scroll
  const fetchProducts = useCallback(
    async (newPage: number = 1, isPaginationOnly: boolean = false) => {
      // For pagination, use isPaginating (keeps products visible)
      // For filter changes, use isLoading (shows skeletons)
      if (isPaginationOnly) {
        setIsPaginating(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (filters.category) params.set("category", filters.category);
        for (const c of filters.conditions) {
          params.append("condition", c);
        }
        if (filters.minPrice) params.set("minPrice", filters.minPrice.toString());
        if (filters.maxPrice) params.set("maxPrice", filters.maxPrice.toString());
        for (const b of filters.brands) {
          params.append("brand", b);
        }
        if (filters.showFavouritesOnly) params.set("favourites", "true");
        params.set("sort", sort);
        params.set("page", newPage.toString());
        params.set("limit", "24");

        const response = await fetch(`/api/listings?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch listings: ${response.status}`);
        }
        const data = await response.json();

        // Batch non-urgent data updates together using startTransition
        startTransition(() => {
          setProducts(data.products);
          setTotal(data.total);
          setPage(newPage);
          setAvailableFilters(data.filters);
        });

        // Only update the URL once we have successfully updated the data.
        router.replace(buildURL(filters, sort, newPage), { scroll: false });

        // Only scroll to top for filter changes, not pagination
        if (!isPaginationOnly) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        // Reset loading states
        setIsLoading(false);
        setIsPaginating(false);
      }
    },
    [filters, sort, router, buildURL]
  );

  // Debounced fetch on filter change
  useEffect(() => {
    // Skip on initial mount - we already have server-rendered data
    if (!isMounted) return;

    // Check if filters or sort actually changed
    const filtersChanged = !areFiltersEqual(prevFiltersRef.current, filters);
    const sortChanged = prevSortRef.current !== sort;

    if (!filtersChanged && !sortChanged) {
      return;
    }

    // Update refs
    prevFiltersRef.current = filters;
    prevSortRef.current = sort;

    // Reset pagination state immediately so UI/URL never stays on a stale page.
    if (page !== 1) {
      setPage(1);
    }

    // Debounce the fetch to avoid excessive requests
    const timeoutId = setTimeout(() => {
      fetchProducts(1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters, sort, isMounted, fetchProducts, page]);

  // Redirect to last valid page if current page exceeds total pages
  useEffect(() => {
    // Skip on initial mount
    if (!isMounted) return;

    if (!isLoading && totalPages > 0 && page > totalPages) {
      fetchProducts(totalPages);
    }
  }, [page, totalPages, isLoading, isMounted, fetchProducts]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Clear all filters
  const handleClearAll = () => {
    const defaultFilters: FilterState = {
      category: null,
      conditions: [],
      minPrice: initialFilters.priceRange.min,
      maxPrice: initialFilters.priceRange.max,
      brands: [],
      showFavouritesOnly: false,
    };
    setFilters(defaultFilters);
    if (globalThis.window !== undefined) {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Handle page change - uses pagination mode (no skeleton flash, no scroll)
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && !isLoading && !isPaginating) {
      fetchProducts(newPage, true); // true = pagination only mode
    }
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.conditions.length > 0) count += filters.conditions.length;
    if (filters.brands.length > 0) count += filters.brands.length;
    if (
      filters.minPrice !== initialFilters.priceRange.min ||
      filters.maxPrice !== initialFilters.priceRange.max
    ) {
      count++;
    }
    return count;
  }, [filters, initialFilters.priceRange]);

  return (
    <Column width="100%" backgroundColor="$surface">
      {/* Page Hero */}
      <PageHero />

      {/* Listings Content */}
      <Column width="100%" paddingVertical="$lg">
        <Column
          maxWidth={1280}
          marginHorizontal="auto"
          paddingHorizontal="$md"
          $gtSm={{ paddingHorizontal: "$lg" }}
          $gtMd={{ paddingHorizontal: "$xl" }}
          $gtLg={{ paddingHorizontal: "$2xl" }}
          width="100%"
          gap="$lg"
        >
          {/* Header */}
          <Row alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$md">
            <Column gap="$xs">
              <Text size="$7" $gtMd={{ size: "$9" }} weight="bold">
                Shop All Products
              </Text>
              <Text color="$textSecondary">
                {total} {total === 1 ? "product" : "products"} found
              </Text>
            </Column>

            <Row gap="$md" alignItems="center">
              {/* Mobile filter button */}
              <Row display="flex" $gtLg={{ display: "none" }}>
                <Button size="$4" chromeless onPress={() => setMobileFilterOpen(true)}>
                  <Row gap="$sm" alignItems="center">
                    <Text>Filters</Text>
                    {activeFilterCount > 0 && (
                      <Badge variant="primary" size="sm">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Row>
                </Button>
              </Row>

              {/* Sort dropdown */}
              <SortDropdown value={sort} onChange={setSort} />
            </Row>
          </Row>

          {/* Active filters chips */}
          {activeFilterCount > 0 && (
            <Row gap="$sm" flexWrap="wrap" alignItems="center">
              <Text size="$3" color="$textSecondary">
                Active filters:
              </Text>
              {filters.category && (
                <Row
                  gap="$2"
                  alignItems="center"
                  backgroundColor="$surface"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$full"
                  paddingVertical="$1.5"
                  paddingLeft="$3"
                  paddingRight="$2"
                >
                  <Text size="$3">{filters.category}</Text>
                  <View
                    cursor="pointer"
                    onPress={() => handleFilterChange({ category: null })}
                    aria-label="Remove category filter"
                    hoverStyle={{ opacity: 0.7 }}
                  >
                    <Text color="$textSecondary" size="$4">
                      ×
                    </Text>
                  </View>
                </Row>
              )}
              {filters.conditions.map((condition) => (
                <Row
                  key={condition}
                  gap="$2"
                  alignItems="center"
                  backgroundColor="$surface"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$full"
                  paddingVertical="$1.5"
                  paddingLeft="$3"
                  paddingRight="$2"
                >
                  <Text size="$3">{condition.replace("_", " ")}</Text>
                  <View
                    cursor="pointer"
                    onPress={() =>
                      handleFilterChange({
                        conditions: filters.conditions.filter((c) => c !== condition),
                      })
                    }
                    aria-label={`Remove ${condition} filter`}
                    hoverStyle={{ opacity: 0.7 }}
                  >
                    <Text color="$textSecondary" size="$4">
                      ×
                    </Text>
                  </View>
                </Row>
              ))}
              {filters.brands.map((brand) => (
                <Row
                  key={brand}
                  gap="$2"
                  alignItems="center"
                  backgroundColor="$surface"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$full"
                  paddingVertical="$1.5"
                  paddingLeft="$3"
                  paddingRight="$2"
                >
                  <Text size="$3">{brand}</Text>
                  <View
                    cursor="pointer"
                    onPress={() =>
                      handleFilterChange({
                        brands: filters.brands.filter((b) => b !== brand),
                      })
                    }
                    aria-label={`Remove ${brand} filter`}
                    hoverStyle={{ opacity: 0.7 }}
                  >
                    <Text color="$textSecondary" size="$4">
                      ×
                    </Text>
                  </View>
                </Row>
              ))}
              <Text
                size="$3"
                color="$primary"
                cursor="pointer"
                onPress={handleClearAll}
                hoverStyle={{ textDecorationLine: "underline" }}
                paddingVertical="$1.5"
                paddingHorizontal="$2"
              >
                Clear all
              </Text>
            </Row>
          )}

          {/* Main content: Sidebar + Grid */}
          <Row gap="$2xl" alignItems="flex-start" style={{ overflow: "visible" }} width="100%">
            {/* Desktop sidebar */}
            <FilterSidebar
              filters={filters}
              availableBrands={availableFilters?.availableBrands || []}
              priceRange={availableFilters?.priceRange || { min: 0, max: 10000 }}
              onChange={handleFilterChange}
              onClearAll={handleClearAll}
            />

            {/* Products grid */}
            <Column flex={1}>
              <ProductsGrid
                products={products}
                isLoading={isLoading}
                isPaginating={isPaginating}
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </Column>
          </Row>
        </Column>

        {/* Mobile filter sheet */}
        <MobileFilterSheet
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          filters={filters}
          availableBrands={availableFilters?.availableBrands || []}
          priceRange={availableFilters?.priceRange || { min: 0, max: 10000 }}
          onChange={handleFilterChange}
          onClearAll={handleClearAll}
          onApply={() => fetchProducts(1)}
        />
      </Column>

      {/* Trust & Newsletter Sections */}
      <TrustSection />
      <NewsletterSection />

      {/* Footer */}
      <FooterSection />
    </Column>
  );
}
