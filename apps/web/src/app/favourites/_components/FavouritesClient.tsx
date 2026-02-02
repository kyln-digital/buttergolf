"use client";

import { useState, useEffect } from "react";
import { Column, Row, Text, Heading, Spinner, Button } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FooterSection } from "../../_components/marketplace/FooterSection";
import { HorizontalProductCard } from "./HorizontalProductCard";

interface FavouritesResponse {
  products: Array<ProductCardData & { favouritedAt: string; description?: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function FavouritesClient() {
  const router = useRouter();
  const [products, setProducts] = useState<FavouritesResponse["products"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
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
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
      } catch (err) {
        console.error("Error fetching favourites:", err);
        setError(err instanceof Error ? err.message : "Failed to load favourites");
      } finally {
        setLoading(false);
      }
    }

    fetchFavourites();
  }, [page, router]);

  // Make Offer Handler - navigate to product page where offer modal exists
  const handleMakeOffer = (productId: string) => {
    router.push(`/products/${productId}?action=offer`);
  };

  // Buy Now Handler
  const handleBuyNow = (productId: string) => {
    router.push(`/checkout?productId=${productId}`);
  };

  // Remove from favourites Handler
  const handleRemove = async (productId: string) => {
    try {
      const response = await fetch(`/api/favourites/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove favourite");
      }

      // Optimistically remove from UI
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      console.error("Error removing favourite:", err);
      setError("Failed to remove from favourites");
    }
  };

  // View Details Handler
  const handleViewDetails = (productId: string) => {
    router.push(`/products/${productId}`);
  };

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
        <Column maxWidth={1400} marginHorizontal="auto" gap="$md" width="100%">
          <Heading level={1} color="$text">
            My favourites
          </Heading>
          <Text size="$6" color="$textSecondary">
            Your saved golf equipment listings
          </Text>
        </Column>
      </Column>

      {/* Main Content */}
      <Column
        maxWidth={1400}
        marginHorizontal="auto"
        paddingHorizontal="$lg"
        paddingVertical="$2xl"
        gap="$2xl"
      >
        {/* Loading State */}
        {loading && (
          <Column alignItems="center" paddingVertical="$2xl">
            <Spinner size="lg" color="$primary" />
            <Text marginTop="$md" color="$textSecondary">
              Loading your favourites...
            </Text>
          </Column>
        )}

        {/* Error State */}
        {error && !loading && (
          <Column
            alignItems="center"
            paddingVertical="$2xl"
            backgroundColor="$errorLight"
            borderRadius="$md"
            padding="$xl"
          >
            <Text color="$error" weight="semibold" size="$6">
              Error
            </Text>
            <Text marginTop="$xs" color="$error">
              {error}
            </Text>
          </Column>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <Column
            alignItems="center"
            paddingVertical="$2xl"
            gap="$lg"
            backgroundColor="$cloudMist"
            borderRadius="$lg"
            padding="$2xl"
            shadowColor="rgba(0,0,0,0.08)"
            shadowOffset={{ width: 0, height: 2 }}
            shadowRadius={8}
          >
            <svg
              width="120"
              height="120"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#EDEDED"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <Heading level={2} color="$text" textAlign="center">
              No favourites yet
            </Heading>
            <Text size="$5" color="$textSecondary" textAlign="center" maxWidth={500}>
              Browse our marketplace to discover amazing golf equipment and save your favourites
              here for easy access.
            </Text>
            <Link href="/listings">
              <Button butterVariant="primary" size="$5" marginTop="$md">
                Browse Listings
              </Button>
            </Link>
          </Column>
        )}

        {/* Products List */}
        {!loading && !error && products.length > 0 && (
          <>
            <Row alignItems="center" justifyContent="space-between">
              <Heading level={2} color="$text">
                {products.length === 1 ? "1 Favourite" : `${products.length} Favourites`}
              </Heading>
            </Row>

            <Column gap="$md" width="100%">
              {products.map((product) => (
                <HorizontalProductCard
                  key={product.id}
                  product={product}
                  onMakeOffer={handleMakeOffer}
                  onBuyNow={handleBuyNow}
                  onRemove={handleRemove}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </Column>

            {/* Pagination */}
            {totalPages > 1 && (
              <Row gap="$md" alignItems="center" justifyContent="center" marginTop="$xl">
                <Button
                  size="$4"
                  backgroundColor={page === 1 ? "$backgroundPress" : "$surface"}
                  color={page === 1 ? "$textMuted" : "$text"}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$md"
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  disabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>

                <Text size="$4" color="$text">
                  Page {page} of {totalPages}
                </Text>

                <Button
                  size="$4"
                  backgroundColor={page === totalPages ? "$backgroundPress" : "$surface"}
                  color={page === totalPages ? "$textMuted" : "$text"}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$md"
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  disabled={page === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </Row>
            )}
          </>
        )}
      </Column>

      <FooterSection />
    </>
  );
}
