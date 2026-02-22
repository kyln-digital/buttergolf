import { useCallback, useEffect, useState } from "react";
import { ScrollView, Alert } from "react-native";
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
import { ArrowLeft, Check, X, Clock, User } from "@tamagui/lucide-icons";

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
    description?: string;
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
    message?: string;
    createdAt: string;
  }[];
}

interface OfferDetailScreenProps {
  /** Offer ID to display */
  offerId: string;
  /** Current user's ID to determine if they're buyer or seller */
  currentUserId: string;
  /** Auth token getter for API calls */
  getToken: () => Promise<string | null>;
  /** Fetch single offer details */
  onFetchOffer: (offerId: string) => Promise<Offer>;
  /** Navigate back */
  onBack: () => void;
  /** Called when offer is accepted - navigate to payment or confirmation */
  onOfferAccepted?: (offer: Offer) => void;
  /** Called when offer status changes */
  onOfferUpdated?: () => void;
  /** Navigate to product detail */
  onViewProduct?: (productId: string) => void;
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
      return "Awaiting Response";
    case "COUNTERED":
      return "Counter Offer";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExpiresIn(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs < 0) return "Expired";

  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} left`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} left`;
  return "Expiring soon";
}

export function OfferDetailScreen({
  offerId,
  currentUserId,
  getToken,
  onFetchOffer,
  onBack,
  onOfferAccepted,
  onOfferUpdated,
  onViewProduct,
}: OfferDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"accept" | "reject" | null>(null);

  const fetchOffer = useCallback(async () => {
    try {
      setError(null);
      const data = await onFetchOffer(offerId);
      setOffer(data);
    } catch (err) {
      console.error("Failed to fetch offer:", err);
      setError("Failed to load offer details");
    } finally {
      setLoading(false);
    }
  }, [offerId, onFetchOffer]);

  useEffect(() => {
    void fetchOffer();
  }, [fetchOffer]);

  const handleAccept = useCallback(async () => {
    if (!offer) return;

    Alert.alert(
      "Accept Offer",
      `Are you sure you want to accept £${offer.amount.toFixed(2)} for "${offer.product.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          style: "default",
          onPress: async () => {
            setActionLoading("accept");
            try {
              const token = await getToken();
              if (!token) throw new Error("Not authenticated");

              const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
              const response = await fetch(`${baseUrl}/api/offers/${offerId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: "ACCEPTED" }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to accept offer");
              }

              const updatedOffer = await response.json();
              setOffer(updatedOffer);
              onOfferUpdated?.();
              onOfferAccepted?.(updatedOffer);
            } catch (err) {
              console.error("Failed to accept offer:", err);
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to accept offer");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [offer, offerId, getToken, onOfferUpdated, onOfferAccepted]);

  const handleReject = useCallback(async () => {
    if (!offer) return;

    Alert.alert(
      "Decline Offer",
      `Are you sure you want to decline this offer of £${offer.amount.toFixed(2)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActionLoading("reject");
            try {
              const token = await getToken();
              if (!token) throw new Error("Not authenticated");

              const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
              const response = await fetch(`${baseUrl}/api/offers/${offerId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: "REJECTED" }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to decline offer");
              }

              const updatedOffer = await response.json();
              setOffer(updatedOffer);
              onOfferUpdated?.();
            } catch (err) {
              console.error("Failed to decline offer:", err);
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to decline offer");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }, [offer, offerId, getToken, onOfferUpdated]);

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
          Loading offer...
        </Text>
      </Column>
    );
  }

  if (error || !offer) {
    return (
      <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
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
          <Heading level={4}>Offer Details</Heading>
        </Row>
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center">
            {error || "Offer not found"}
          </Text>
          <Button butterVariant="primary" size="$4" marginTop="$4" onPress={onBack}>
            Go Back
          </Button>
        </Column>
      </Column>
    );
  }

  const isSeller = offer.seller.id === currentUserId;
  const isBuyer = offer.buyer.id === currentUserId;
  const productImage = offer.product.images[0]?.url;
  const canRespond = isSeller && offer.status === "PENDING";
  const savings = offer.product.price - offer.amount;
  const savingsPercent = Math.round((savings / offer.product.price) * 100);

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
        <Heading level={4}>Offer Details</Heading>
      </Row>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + (canRespond ? 100 : 16),
        }}
      >
        {/* Status Banner */}
        <Card
          variant="filled"
          padding="$md"
          marginBottom="$4"
          backgroundColor={
            offer.status === "ACCEPTED"
              ? "$successLight"
              : offer.status === "REJECTED"
                ? "$errorLight"
                : offer.status === "PENDING"
                  ? "$warningLight"
                  : "$gray100"
          }
        >
          <Row alignItems="center" justifyContent="center" gap="$sm">
            <Badge variant={getStatusBadgeVariant(offer.status)} size="md">
              <Text fontWeight="600">{getStatusLabel(offer.status)}</Text>
            </Badge>
            {offer.status === "PENDING" && offer.expiresAt && (
              <Row alignItems="center" gap="$xs">
                <Clock size={14} color="$textSecondary" />
                <Text size="$3" color="$textSecondary">
                  {formatExpiresIn(offer.expiresAt)}
                </Text>
              </Row>
            )}
          </Row>
        </Card>

        {/* Product Card */}
        <Card
          variant="outlined"
          padding="$md"
          marginBottom="$4"
          pressStyle={onViewProduct ? { scale: 0.98 } : undefined}
          onPress={onViewProduct ? () => onViewProduct(offer.product.id) : undefined}
        >
          <Row gap="$md" alignItems="flex-start">
            {productImage ? (
              <Image
                src={productImage}
                width={100}
                height={100}
                borderRadius="$md"
                backgroundColor="$gray100"
              />
            ) : (
              <View
                width={100}
                height={100}
                borderRadius="$md"
                backgroundColor="$gray100"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="$textSecondary">No Image</Text>
              </View>
            )}
            <Column flex={1} gap="$xs">
              <Text size="$5" fontWeight="600" numberOfLines={2}>
                {offer.product.title}
              </Text>
              <Row alignItems="center" gap="$sm">
                <Text size="$4" color="$textSecondary" textDecorationLine="line-through">
                  £{offer.product.price.toFixed(2)}
                </Text>
              </Row>
              {onViewProduct && (
                <Text size="$3" color="$primary" marginTop="$xs">
                  View listing →
                </Text>
              )}
            </Column>
          </Row>
        </Card>

        {/* Offer Amount */}
        <Card variant="outlined" padding="$lg" marginBottom="$4">
          <Column alignItems="center" gap="$sm">
            <Text size="$4" color="$textSecondary">
              Offer Amount
            </Text>
            <Text size="$10" fontWeight="700" color="$primary">
              £{offer.amount.toFixed(2)}
            </Text>
            {savings > 0 && (
              <Badge variant="success" size="sm">
                <Text size="$2">
                  {savingsPercent}% off (saves £{savings.toFixed(2)})
                </Text>
              </Badge>
            )}
          </Column>
        </Card>

        {/* Parties */}
        <Card variant="outlined" padding="$md" marginBottom="$4">
          <Column gap="$md">
            <Row alignItems="center" gap="$md">
              {offer.buyer.imageUrl ? (
                <Image src={offer.buyer.imageUrl} width={40} height={40} borderRadius="$full" />
              ) : (
                <View
                  width={40}
                  height={40}
                  borderRadius="$full"
                  backgroundColor="$gray200"
                  alignItems="center"
                  justifyContent="center"
                >
                  <User size={20} color="$textSecondary" />
                </View>
              )}
              <Column flex={1}>
                <Text size="$3" color="$textSecondary">
                  Buyer {isBuyer && "(You)"}
                </Text>
                <Text size="$4" fontWeight="500">
                  {`${offer.buyer.firstName || ""} ${offer.buyer.lastName || ""}`.trim() ||
                    "Unknown"}
                </Text>
              </Column>
            </Row>

            <View height={1} backgroundColor="$border" />

            <Row alignItems="center" gap="$md">
              {offer.seller.imageUrl ? (
                <Image src={offer.seller.imageUrl} width={40} height={40} borderRadius="$full" />
              ) : (
                <View
                  width={40}
                  height={40}
                  borderRadius="$full"
                  backgroundColor="$gray200"
                  alignItems="center"
                  justifyContent="center"
                >
                  <User size={20} color="$textSecondary" />
                </View>
              )}
              <Column flex={1}>
                <Text size="$3" color="$textSecondary">
                  Seller {isSeller && "(You)"}
                </Text>
                <Text size="$4" fontWeight="500">
                  {`${offer.seller.firstName || ""} ${offer.seller.lastName || ""}`.trim() ||
                    "Unknown"}
                </Text>
              </Column>
            </Row>
          </Column>
        </Card>

        {/* Message (if any) */}
        {offer.message && (
          <Card variant="outlined" padding="$md" marginBottom="$4">
            <Column gap="$sm">
              <Text size="$3" color="$textSecondary">
                Message from {isBuyer ? "you" : "buyer"}
              </Text>
              <Text size="$4">{offer.message}</Text>
            </Column>
          </Card>
        )}

        {/* Timeline */}
        <Card variant="outlined" padding="$md" marginBottom="$4">
          <Column gap="$sm">
            <Text size="$4" fontWeight="600">
              Timeline
            </Text>
            <Row alignItems="center" gap="$sm">
              <Clock size={14} color="$textSecondary" />
              <Text size="$3" color="$textSecondary">
                Offer made {formatDate(offer.createdAt)}
              </Text>
            </Row>
            {offer.expiresAt && offer.status === "PENDING" && (
              <Row alignItems="center" gap="$sm">
                <Clock size={14} color="$warning" />
                <Text size="$3" color="$warning">
                  Expires {formatDate(offer.expiresAt)}
                </Text>
              </Row>
            )}
          </Column>
        </Card>

        {/* Info for buyers */}
        {isBuyer && offer.status === "PENDING" && (
          <Card variant="filled" padding="$md" backgroundColor="$infoLight">
            <Text size="$3" color="$text" textAlign="center">
              The seller has 7 days to respond to your offer. You&apos;ll be notified when they
              accept or decline.
            </Text>
          </Card>
        )}

        {/* Info for accepted offers */}
        {offer.status === "ACCEPTED" && isBuyer && (
          <Card variant="filled" padding="$md" backgroundColor="$successLight" marginBottom="$4">
            <Text size="$4" fontWeight="600" color="$success" textAlign="center" marginBottom="$sm">
              Your offer was accepted!
            </Text>
            <Text size="$3" color="$text" textAlign="center">
              Complete your purchase to secure this item at the agreed price.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Seller Action Buttons */}
      {canRespond && (
        <Row
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          padding="$4"
          paddingBottom={insets.bottom + 16}
          backgroundColor="$background"
          borderTopWidth={1}
          borderTopColor="$border"
          gap="$3"
        >
          <Button
            flex={1}
            size="$5"
            backgroundColor="$error"
            color="$textInverse"
            onPress={handleReject}
            disabled={actionLoading !== null}
            opacity={actionLoading === "reject" ? 0.7 : 1}
            icon={
              actionLoading === "reject" ? (
                <Spinner size="sm" color="$textInverse" />
              ) : (
                <X size={20} />
              )
            }
          >
            {actionLoading === "reject" ? "Declining..." : "Decline"}
          </Button>
          <Button
            flex={1}
            size="$5"
            backgroundColor="$success"
            color="$textInverse"
            onPress={handleAccept}
            disabled={actionLoading !== null}
            opacity={actionLoading === "accept" ? 0.7 : 1}
            icon={
              actionLoading === "accept" ? (
                <Spinner size="sm" color="$textInverse" />
              ) : (
                <Check size={20} />
              )
            }
          >
            {actionLoading === "accept" ? "Accepting..." : "Accept"}
          </Button>
        </Row>
      )}
    </Column>
  );
}
