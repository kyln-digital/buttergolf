"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Card, Spinner, Theme } from "@buttergolf/ui";
import { useTheme } from "tamagui";
import { Plus, Package, Eye, Heart, Tag } from "@tamagui/lucide-icons";
import Link from "next/link";
import { SellerProductCard, type SellerProduct } from "./SellerProductCard";
import { EditProductModal } from "./EditProductModal";

interface SellerHubStats {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalViews: number;
  totalFavourites: number;
  pendingOffers: number;
}

interface SellerHubResponse {
  products: SellerProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: SellerHubStats;
}

const EMPTY_SELLER_HUB_RESPONSE: SellerHubResponse = {
  products: [],
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasMore: false,
  },
  stats: {
    totalListings: 0,
    activeListings: 0,
    soldListings: 0,
    totalViews: 0,
    totalFavourites: 0,
    pendingOffers: 0,
  },
};

/**
 * SellerHub Component
 *
 * Dashboard for sellers to manage their active listings
 * Shows stats, product grid with filters, and inline editing
 */
export function SellerHub() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const theme = useTheme();

  const [data, setData] = useState<SellerHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "sold">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price-asc" | "price-desc" | "views">(
    "newest"
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in?redirect=/");
    }
  }, [isLoaded, isSignedIn, router]);

  // Fetch listings
  const fetchListings = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        status: statusFilter,
        sort: sortBy,
        page: page.toString(),
        limit: "12",
      });

      const response = await fetch(`/api/seller/listings?${params.toString()}`);
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        // Older deployments may return 404 when the Clerk user exists but DB user sync hasn't completed yet.
        // Treat this as an empty seller state instead of a hard error.
        if (response.status === 404 && responseData?.error === "User not found") {
          setData({
            ...EMPTY_SELLER_HUB_RESPONSE,
            pagination: {
              ...EMPTY_SELLER_HUB_RESPONSE.pagination,
              page,
            },
          });
          setCurrentPage(page);
          return;
        }

        throw new Error(responseData?.error || "Failed to fetch listings");
      }

      setData(responseData);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isSignedIn) {
      void fetchListings(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, statusFilter, sortBy]);

  // Handle product actions
  const handleDelete = async (productId: string) => {
    try {
      const response = await fetch(`/api/seller/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete product");
      }

      // Refresh listings
      fetchListings(currentPage);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const handleMarkSold = async (productId: string) => {
    const product = data?.products.find((p) => p.id === productId);
    if (!product) return;

    try {
      const response = await fetch(`/api/seller/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSold: !product.isSold }),
      });

      if (!response.ok) {
        throw new Error("Failed to update product");
      }

      // Refresh listings
      fetchListings(currentPage);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update product");
    }
  };

  const handleSaveEdit = async (productId: string, updates: Partial<SellerProduct>) => {
    const response = await fetch(`/api/seller/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update product");
    }

    // Refresh listings
    await fetchListings(currentPage);
  };

  // Don't render anything while checking auth
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  // Loading state
  if (loading && !data) {
    return (
      <Column
        width="100%"
        minHeight={500}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
      >
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$md">
          Loading your listings...
        </Text>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column
        width="100%"
        minHeight={500}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
        paddingHorizontal="$md"
      >
        <Card variant="filled" padding="$lg" backgroundColor="$errorLight">
          <Text color="$error">{error}</Text>
        </Card>
      </Column>
    );
  }

  // Empty state
  if (data?.products.length === 0 && statusFilter === "all") {
    return (
      <Column
        width="100%"
        minHeight={500}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
        paddingHorizontal="$md"
      >
        <Column
          maxWidth={600}
          gap="$lg"
          alignItems="center"
          padding="$8"
          backgroundColor="$surface"
          borderRadius="$2xl"
          borderWidth={1}
          borderColor="$border"
        >
          <Package size={64} color="$slateSmoke" />
          <Heading level={2} textAlign="center">
            No listings yet
          </Heading>
          <Text size="$5" align="center" color="$textSecondary">
            Start selling your golf equipment today! Create your first listing in under 60 seconds.
          </Text>
          <Link href="/sell" style={{ textDecoration: "none" }}>
            <Button butterVariant="primary" size="$5">
              <Row gap="$sm" alignItems="center">
                <Plus size={20} />
                <Text color="$textInverse">Create First Listing</Text>
              </Row>
            </Button>
          </Link>
        </Column>
      </Column>
    );
  }

  return (
    <Column width="100%" backgroundColor="$background" paddingVertical="$8">
      <Column
        maxWidth={1280}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        width="100%"
        gap="$xl"
      >
        {/* Header */}
        <Row alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$md">
          <Column gap="$xs">
            <Heading level={2}>Seller Dashboard</Heading>
            <Text color="$textSecondary">Manage your active listings and track performance</Text>
          </Column>
          <Link href="/sell" style={{ textDecoration: "none" }}>
            <Button butterVariant="primary" size="$5">
              <Row gap="$sm" alignItems="center">
                <Plus size={20} color="white" />
                <Text color="$textInverse" weight="semibold">
                  New Listing
                </Text>
              </Row>
            </Button>
          </Link>
        </Row>

        {/* Stats Dashboard */}
        {data?.stats && (
          <Row gap="$md" flexWrap="wrap">
            <Card variant="elevated" padding="$lg" flex={1} minWidth={200}>
              <Column gap="$sm">
                <Row alignItems="center" gap="$sm">
                  <Package size={20} color="$primary" />
                  <Text color="$textSecondary">Total Listings</Text>
                </Row>
                <Text size="$9" weight="bold">
                  {data.stats.totalListings}
                </Text>
                <Text size="$3" color="$textSecondary">
                  {data.stats.activeListings} active • {data.stats.soldListings} sold
                </Text>
              </Column>
            </Card>

            <Card variant="elevated" padding="$lg" flex={1} minWidth={200}>
              <Column gap="$sm">
                <Row alignItems="center" gap="$sm">
                  <Eye size={20} color="$info" />
                  <Text color="$textSecondary">Total Views</Text>
                </Row>
                <Text size="$9" weight="bold">
                  {data.stats.totalViews}
                </Text>
                <Text size="$3" color="$textSecondary">
                  Across all listings
                </Text>
              </Column>
            </Card>

            <Card variant="elevated" padding="$lg" flex={1} minWidth={200}>
              <Column gap="$sm">
                <Row alignItems="center" gap="$sm">
                  <Heart size={20} color="$error" />
                  <Text color="$textSecondary">Total Favourites</Text>
                </Row>
                <Text size="$9" weight="bold">
                  {data.stats.totalFavourites}
                </Text>
                <Text size="$3" color="$textSecondary">
                  People interested
                </Text>
              </Column>
            </Card>

            <Card variant="elevated" padding="$lg" flex={1} minWidth={200}>
              <Column gap="$sm">
                <Row alignItems="center" gap="$sm">
                  <Tag size={20} color="$warning" />
                  <Text color="$textSecondary">Pending Offers</Text>
                </Row>
                <Text size="$9" weight="bold">
                  {data.stats.pendingOffers}
                </Text>
                <Text size="$3" color="$textSecondary">
                  Awaiting response
                </Text>
              </Column>
            </Card>
          </Row>
        )}

        {/* Filters */}
        <Card variant="outlined" padding="$md">
          <Row gap="$md" alignItems="center" flexWrap="wrap" justifyContent="space-between">
            {/* Status Filter */}
            <Row gap="$sm" alignItems="center" flexWrap="wrap">
              <Text weight="medium">Status:</Text>
              <Row gap="$xs">
                {(["all", "active", "sold"] as const).map((status) => (
                  <Theme key={status} name={statusFilter === status ? "active" : null}>
                    <Button
                      size="$3"
                      backgroundColor={statusFilter === status ? "$primary" : "transparent"}
                      color={statusFilter === status ? "$textInverse" : "$text"}
                      borderWidth={1}
                      borderColor={statusFilter === status ? "$primary" : "$border"}
                      borderRadius="$full"
                      paddingHorizontal="$md"
                      paddingVertical="$sm"
                      shadowColor="transparent"
                      shadowOffset={{ width: 0, height: 0 }}
                      shadowOpacity={0}
                      shadowRadius={0}
                      elevation={0}
                      style={{ boxShadow: "none" }}
                      onPress={() => setStatusFilter(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  </Theme>
                ))}
              </Row>
            </Row>

            {/* Sort */}
            <Row gap="$sm" alignItems="center">
              <Text weight="medium">Sort:</Text>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={{
                  height: 40,
                  paddingLeft: 16,
                  paddingRight: 40,
                  fontSize: 15,
                  fontFamily: "inherit",
                  fontWeight: 500,
                  borderRadius: 24,
                  border: `1px solid ${theme.fieldBorder.val}`,
                  backgroundColor: theme.surface.val,
                  color: theme.text.val,
                  cursor: "pointer",
                  minWidth: 180,
                  outline: "none",
                  appearance: "none",
                  WebkitAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(theme.text.val)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 16px center",
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="views">Most Viewed</option>
              </select>
            </Row>
          </Row>
        </Card>

        {/* Products Grid */}
        {data && data.products.length > 0 ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "24px",
              }}
            >
              {data.products.map((product) => (
                <SellerProductCard
                  key={product.id}
                  product={product}
                  onEdit={setEditingProduct}
                  onDelete={handleDelete}
                  onMarkSold={handleMarkSold}
                />
              ))}
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <Row gap="$sm" alignItems="center" justifyContent="center">
                <Button
                  size="$4"
                  backgroundColor="transparent"
                  color="$primary"
                  borderWidth={2}
                  borderColor="$primary"
                  borderRadius="$full"
                  paddingHorizontal="$4"
                  paddingVertical="$3"
                  disabled={currentPage === 1}
                  onPress={() => fetchListings(currentPage - 1)}
                >
                  Previous
                </Button>
                <Text>
                  Page {currentPage} of {data.pagination.totalPages}
                </Text>
                <Button
                  size="$4"
                  backgroundColor="transparent"
                  color="$primary"
                  borderWidth={2}
                  borderColor="$primary"
                  borderRadius="$full"
                  paddingHorizontal="$4"
                  paddingVertical="$3"
                  disabled={!data.pagination.hasMore}
                  onPress={() => fetchListings(currentPage + 1)}
                >
                  Next
                </Button>
              </Row>
            )}
          </>
        ) : (
          <Column alignItems="center" padding="$8">
            <Text color="$textSecondary">
              No {statusFilter === "all" ? "" : statusFilter} listings found
            </Text>
          </Column>
        )}
      </Column>

      {/* Edit Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveEdit}
        />
      )}
    </Column>
  );
}
