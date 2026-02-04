import { useCallback, useEffect, useState } from "react";
import { RefreshControl, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Column,
  Row,
  Text,
  Button,
  Heading,
  Card,
  Spinner,
  Badge,
  Image,
  View,
} from "@buttergolf/ui";
import { ArrowLeft, ChevronRight } from "@tamagui/lucide-icons";

// Offer status type matching Prisma enum
type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTERED" | "EXPIRED";

// Offer type matching API response
interface Offer {
  id: string;
  amount: number;
  status: OfferStatus;
  message?: string;
  expiresAt?: string;
  createdAt: string;
  product: {
    id: string;
    title: string;
    price: number;
    images: { url: string }[];
  };
  buyer: {
    id: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  };
  seller: {
    id: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  };
  counterOffers?: {
    id: string;
    amount: number;
    fromSeller: boolean;
    createdAt: string;
  }[];
}

interface OffersListScreenProps {
  /** Current user's ID to determine if they're buyer or seller */
  currentUserId: string;
  /** Function to fetch offers list */
  onFetchOffers: () => Promise<Offer[]>;
  /** Navigate to offer detail screen */
  onViewOffer: (offerId: string) => void;
  /** Navigate back */
  onBack: () => void;
  /** Navigate to browse listings (when no offers) */
  onBrowseListings?: () => void;
}

function getStatusBadgeVariant(
  status: OfferStatus
): "success" | "error" | "warning" | "info" | "neutral" {
  switch (status) {
    case "ACCEPTED":
      return "success";
    case "REJECTED":
      return "error";
    case "PENDING":
      return "warning";
    case "COUNTERED":
      return "info";
    case "EXPIRED":
      return "neutral";
    default:
      return "neutral";
  }
}

function getStatusLabel(status: OfferStatus): string {
  switch (status) {
    case "ACCEPTED":
      return "Accepted";
    case "REJECTED":
      return "Declined";
    case "PENDING":
      return "Pending";
    case "COUNTERED":
      return "Counter Offer";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function OffersListScreen({
  currentUserId,
  onFetchOffers,
  onViewOffer,
  onBack,
  onBrowseListings,
}: OffersListScreenProps) {
  const insets = useSafeAreaInsets();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      setError(null);
      const data = await onFetchOffers();
      setOffers(data);
    } catch (err) {
      console.error("Failed to fetch offers:", err);
      setError("Failed to load offers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onFetchOffers]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchOffers();
  }, [fetchOffers]);

  const renderOffer = useCallback(
    ({ item: offer }: { item: Offer }) => {
      const isBuyer = offer.buyer.id === currentUserId;
      const otherParty = isBuyer ? offer.seller : offer.buyer;
      const otherPartyName =
        `${otherParty.firstName || ""} ${otherParty.lastName || ""}`.trim() || "Unknown";
      const productImage = offer.product.images[0]?.url;

      // Get latest amount (either original or last counter)
      const latestAmount = offer.counterOffers?.length
        ? (offer.counterOffers[offer.counterOffers.length - 1]?.amount ?? offer.amount)
        : offer.amount;

      return (
        <Card
          variant="outlined"
          padding="$md"
          marginBottom="$sm"
          pressStyle={{ scale: 0.98, backgroundColor: "$backgroundHover" }}
          onPress={() => onViewOffer(offer.id)}
        >
          <Row gap="$md" alignItems="flex-start">
            {/* Product Image */}
            {productImage ? (
              <Image
                source={{ uri: productImage }}
                width={80}
                height={80}
                borderRadius="$md"
                backgroundColor="$gray100"
              />
            ) : (
              <View
                width={80}
                height={80}
                borderRadius="$md"
                backgroundColor="$gray100"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="$textSecondary">No Image</Text>
              </View>
            )}

            {/* Offer Details */}
            <Column flex={1} gap="$xs">
              <Row justifyContent="space-between" alignItems="flex-start">
                <Column flex={1} gap="$xs">
                  <Text size="$4" fontWeight="600" numberOfLines={2}>
                    {offer.product.title}
                  </Text>
                  <Text size="$3" color="$textSecondary">
                    {isBuyer ? "Seller: " : "Buyer: "}
                    {otherPartyName}
                  </Text>
                </Column>
                <ChevronRight size={20} color="$slateSmoke" />
              </Row>

              <Row justifyContent="space-between" alignItems="center" marginTop="$xs">
                <Column gap="$xs">
                  <Row alignItems="center" gap="$sm">
                    <Text size="$5" fontWeight="700" color="$primary">
                      £{latestAmount.toFixed(2)}
                    </Text>
                    {latestAmount !== offer.product.price && (
                      <Text size="$3" color="$textSecondary" textDecorationLine="line-through">
                        £{offer.product.price.toFixed(2)}
                      </Text>
                    )}
                  </Row>
                  <Text size="$2" color="$textSecondary">
                    {formatTimeAgo(offer.createdAt)}
                  </Text>
                </Column>

                <Badge variant={getStatusBadgeVariant(offer.status)} size="sm">
                  <Text size="$2" fontWeight="600">
                    {getStatusLabel(offer.status)}
                  </Text>
                </Badge>
              </Row>
            </Column>
          </Row>
        </Card>
      );
    },
    [currentUserId, onViewOffer]
  );

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
          Loading offers...
        </Text>
      </Column>
    );
  }

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
        <Button
          size="$4"
          circular
          chromeless
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Heading level={4}>My Offers</Heading>
      </Row>

      {error ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center">
            {error}
          </Text>
          <Button butterVariant="primary" size="$4" marginTop="$4" onPress={handleRefresh}>
            Try Again
          </Button>
        </Column>
      ) : offers.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4" gap="$4">
          <Text size="$7">📭</Text>
          <Text size="$6" fontWeight="600" textAlign="center">
            No offers yet
          </Text>
          <Text color="$textSecondary" textAlign="center">
            When you make or receive offers, they&apos;ll appear here.
          </Text>
          {onBrowseListings && (
            <Button butterVariant="primary" size="$4" marginTop="$2" onPress={onBrowseListings}>
              Browse Listings
            </Button>
          )}
        </Column>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          renderItem={renderOffer}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
      )}
    </Column>
  );
}
