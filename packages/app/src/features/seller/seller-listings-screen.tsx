"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Column, Row, Text, Button, Heading, ScrollView, Spinner, View } from "@buttergolf/ui";
import {
  ArrowLeft,
  Package,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  Check,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Image as RNImage } from "react-native";

type ListingStatus = "ACTIVE" | "SOLD" | "DRAFT" | "INACTIVE";

interface Listing {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: ListingStatus;
  viewCount: number;
  favouriteCount: number;
  category: string;
  createdAt: string;
  soldAt?: string;
}

interface ListingsResponse {
  listings: Listing[];
  stats: {
    active: number;
    sold: number;
    draft: number;
    totalViews: number;
  };
}

export interface SellerListingsScreenProps {
  /** Fetch seller's listings */
  onFetchListings: (filter?: string) => Promise<ListingsResponse>;
  /** Navigate to create a new listing */
  onCreateListing: () => void;
  /** Navigate to edit a listing */
  onEditListing: (listingId: string) => void;
  /** Navigate to view a listing */
  onViewListing: (listingId: string) => void;
  /** Deactivate/reactivate a listing */
  onToggleStatus: (listingId: string, active: boolean) => Promise<void>;
  /** Delete a listing (draft only) */
  onDeleteListing: (listingId: string) => Promise<void>;
  /** Navigate back */
  onBack: () => void;
}

type FilterTab = "all" | "active" | "sold" | "draft";

type StatusColorToken = "$success" | "$primary" | "$textMuted" | "$warning";
type StatusColorLightToken = "$successLight" | "$primaryLight" | "$gray200" | "$warningLight";

const statusConfig: Record<
  ListingStatus,
  { label: string; color: StatusColorToken; bgColor: StatusColorLightToken }
> = {
  ACTIVE: { label: "Active", color: "$success", bgColor: "$successLight" },
  SOLD: { label: "Sold", color: "$primary", bgColor: "$primaryLight" },
  DRAFT: { label: "Draft", color: "$textMuted", bgColor: "$gray200" },
  INACTIVE: { label: "Inactive", color: "$warning", bgColor: "$warningLight" },
};

export function SellerListingsScreen({
  onFetchListings,
  onCreateListing,
  onEditListing,
  onViewListing,
  onToggleStatus,
  onDeleteListing,
  onBack,
}: Readonly<SellerListingsScreenProps>) {
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<ListingsResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("active");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      setError(null);
      const filter = activeFilter === "all" ? undefined : activeFilter;
      const response = await onFetchListings(filter);
      setListings(response.listings);
      setStats(response.stats);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
      setError("Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [onFetchListings, activeFilter]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  const handleToggleStatus = useCallback(
    async (listing: Listing) => {
      const newActive = listing.status !== "ACTIVE";
      const action = newActive ? "activate" : "deactivate";

      Alert.alert(
        `${newActive ? "Activate" : "Deactivate"} Listing`,
        `Are you sure you want to ${action} "${listing.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: newActive ? "Activate" : "Deactivate",
            style: newActive ? "default" : "destructive",
            onPress: async () => {
              setProcessingId(listing.id);
              try {
                await onToggleStatus(listing.id, newActive);
                void fetchListings();
              } catch (err) {
                Alert.alert("Error", `Failed to ${action} listing`);
              } finally {
                setProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [onToggleStatus, fetchListings]
  );

  const handleDelete = useCallback(
    (listing: Listing) => {
      if (listing.status !== "DRAFT") {
        Alert.alert("Cannot Delete", "Only draft listings can be deleted.");
        return;
      }

      Alert.alert(
        "Delete Listing",
        `Are you sure you want to delete "${listing.title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setProcessingId(listing.id);
              try {
                await onDeleteListing(listing.id);
                void fetchListings();
              } catch (err) {
                Alert.alert("Error", "Failed to delete listing");
              } finally {
                setProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [onDeleteListing, fetchListings]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount / 100);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

  // Loading state
  if (loading) {
    return (
      <Column
        flex={1}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        paddingTop={insets.top}
      >
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$3">
          Loading listings...
        </Text>
      </Column>
    );
  }

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active", count: stats?.active },
    { key: "sold", label: "Sold", count: stats?.sold },
    { key: "draft", label: "Drafts", count: stats?.draft },
  ];

  return (
    <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* Header */}
      <Row
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Heading level={4} flex={1}>
          My Listings
        </Heading>
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={onCreateListing}
          icon={<Plus size={24} color="$primary" />}
        />
      </Row>

      {/* Stats Row */}
      {stats && (
        <Row
          paddingHorizontal="$4"
          paddingVertical="$3"
          gap="$4"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <Column alignItems="center" flex={1}>
            <Text size="$6" fontWeight="700" color="$success">
              {stats.active}
            </Text>
            <Text size="$2" color="$textSecondary">
              Active
            </Text>
          </Column>
          <Column alignItems="center" flex={1}>
            <Text size="$6" fontWeight="700" color="$primary">
              {stats.sold}
            </Text>
            <Text size="$2" color="$textSecondary">
              Sold
            </Text>
          </Column>
          <Column alignItems="center" flex={1}>
            <Text size="$6" fontWeight="700" color="$textMuted">
              {stats.totalViews}
            </Text>
            <Text size="$2" color="$textSecondary">
              Total Views
            </Text>
          </Column>
        </Row>
      )}

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        {filterTabs.map((tab) => (
          <TamaguiButton
            key={tab.key}
            backgroundColor={activeFilter === tab.key ? "$primary" : "$surface"}
            borderRadius="$full"
            paddingHorizontal="$4"
            paddingVertical="$2"
            borderWidth={1}
            borderColor={activeFilter === tab.key ? "$primary" : "$border"}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Row gap="$2" alignItems="center">
              <Text
                size="$3"
                fontWeight="500"
                color={activeFilter === tab.key ? "$textInverse" : "$text"}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  backgroundColor={activeFilter === tab.key ? "$overlayLight20" : "$gray200"}
                  borderRadius="$full"
                  paddingHorizontal="$2"
                  minWidth={20}
                  alignItems="center"
                >
                  <Text
                    size="$2"
                    fontWeight="600"
                    color={activeFilter === tab.key ? "$textInverse" : "$text"}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </Row>
          </TamaguiButton>
        ))}
      </ScrollView>

      {error ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center" marginBottom="$4">
            {error}
          </Text>
          <Button butterVariant="primary" size="$4" onPress={() => void fetchListings()}>
            Try Again
          </Button>
        </Column>
      ) : listings.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Package size={64} color="$textMuted" />
          <Text size="$5" color="$textSecondary" marginTop="$4" textAlign="center">
            No {activeFilter === "all" ? "" : activeFilter} listings
          </Text>
          <Text size="$4" color="$textMuted" marginTop="$2" textAlign="center">
            {activeFilter === "sold"
              ? "Your sold items will appear here"
              : "List your first item to start selling"}
          </Text>
          {activeFilter !== "sold" && (
            <Button butterVariant="primary" size="$4" marginTop="$4" onPress={onCreateListing}>
              List an Item
            </Button>
          )}
        </Column>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Column gap="$3">
            {listings.map((listing) => {
              const config = statusConfig[listing.status];
              const isProcessing = processingId === listing.id;

              return (
                <TamaguiButton
                  key={listing.id}
                  unstyled
                  backgroundColor="$surface"
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor="$border"
                  overflow="hidden"
                  pressStyle={{ backgroundColor: "$backgroundPress" }}
                  onPress={() => onViewListing(listing.id)}
                  disabled={isProcessing}
                  opacity={isProcessing ? 0.6 : 1}
                >
                  <Row padding="$3" gap="$3">
                    {/* Image */}
                    <View
                      width={80}
                      height={80}
                      borderRadius="$md"
                      backgroundColor="$gray100"
                      overflow="hidden"
                    >
                      {listing.images[0] && (
                        <RNImage
                          source={{ uri: listing.images[0] }}
                          style={{ width: 80, height: 80 }}
                          resizeMode="cover"
                        />
                      )}
                      {listing.status === "SOLD" && (
                        <View
                          position="absolute"
                          top={0}
                          left={0}
                          right={0}
                          bottom={0}
                          backgroundColor="rgba(0,0,0,0.5)"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Check size={32} color="white" />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <Column flex={1} gap="$1">
                      <Text size="$4" fontWeight="500" numberOfLines={1}>
                        {listing.title}
                      </Text>
                      <Text size="$5" fontWeight="700" color="$primary">
                        {formatCurrency(listing.price)}
                      </Text>
                      <Row alignItems="center" gap="$2">
                        <View
                          backgroundColor={config.bgColor}
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          borderRadius="$sm"
                        >
                          <Text size="$2" color={config.color} fontWeight="600">
                            {config.label}
                          </Text>
                        </View>
                        <Row alignItems="center" gap="$1">
                          <Eye size={12} color="$textMuted" />
                          <Text size="$2" color="$textMuted">
                            {listing.viewCount}
                          </Text>
                        </Row>
                      </Row>
                      <Text size="$2" color="$textMuted">
                        {listing.category} • Listed {formatDate(listing.createdAt)}
                      </Text>
                    </Column>

                    <ChevronRight size={20} color="$textMuted" />
                  </Row>

                  {/* Quick Actions */}
                  {listing.status !== "SOLD" && (
                    <Row
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderTopWidth={1}
                      borderTopColor="$border"
                      gap="$2"
                      justifyContent="flex-end"
                    >
                      <TamaguiButton
                        size="$3"
                        chromeless
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          onEditListing(listing.id);
                        }}
                        icon={<Edit3 size={16} color="$text" />}
                      >
                        <Text size="$2">Edit</Text>
                      </TamaguiButton>

                      {listing.status === "ACTIVE" && (
                        <TamaguiButton
                          size="$3"
                          chromeless
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            handleToggleStatus(listing);
                          }}
                          icon={<EyeOff size={16} color="$warning" />}
                        >
                          <Text size="$2" color="$warning">
                            Deactivate
                          </Text>
                        </TamaguiButton>
                      )}

                      {listing.status === "INACTIVE" && (
                        <TamaguiButton
                          size="$3"
                          chromeless
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            handleToggleStatus(listing);
                          }}
                          icon={<Eye size={16} color="$success" />}
                        >
                          <Text size="$2" color="$success">
                            Activate
                          </Text>
                        </TamaguiButton>
                      )}

                      {listing.status === "DRAFT" && (
                        <TamaguiButton
                          size="$3"
                          chromeless
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            handleDelete(listing);
                          }}
                          icon={<Trash2 size={16} color="$error" />}
                        >
                          <Text size="$2" color="$error">
                            Delete
                          </Text>
                        </TamaguiButton>
                      )}
                    </Row>
                  )}
                </TamaguiButton>
              );
            })}
          </Column>
        </ScrollView>
      )}
    </Column>
  );
}
