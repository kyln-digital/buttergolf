"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Column, Row, Text, Heading, Badge, ScrollView, View, Image, Button } from "@buttergolf/ui";
import { MessageSquare } from "@tamagui/lucide-icons";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "../MessagesLayout";
import { ThreadListSkeleton } from "./ThreadListSkeleton";
import { SellerQuickProfilePopover } from "./SellerQuickProfilePopover";
import { ListingDetailsPanel } from "./ListingDetailsPanel";

interface ThreadListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getConversationStatus(
  productSold: boolean,
  latestOfferStatus: string | null,
  lastMessageType: string | null,
  lastMessagePreview: string | null
): { label: string; color: "$warning" | "$primary" | "$success" } | null {
  if (productSold) {
    return { label: "Sold", color: "$warning" };
  }

  if (lastMessageType === "OFFER_ACCEPTED") {
    return { label: "Accepted", color: "$success" };
  }

  switch (latestOfferStatus) {
    case "PENDING":
      return { label: "Offer", color: "$primary" };
    case "COUNTERED":
      return { label: "Counter", color: "$primary" };
    case "ACCEPTED":
      return { label: "Accepted", color: "$success" };
    default:
      break;
  }

  const preview = (lastMessagePreview || "").toLowerCase();
  if (preview.includes("offer accepted")) {
    return { label: "Accepted", color: "$success" };
  }

  return null;
}

export function ThreadList({ conversations, activeConversationId, loading }: ThreadListProps) {
  const [selectedListing, setSelectedListing] = useState<Conversation | null>(null);
  const router = useRouter();

  if (loading) {
    return <ThreadListSkeleton />;
  }

  return (
    <Column height="100%">
      {/* Header */}
      <Column
        paddingHorizontal="$lg"
        paddingVertical="$md"
        borderBottomWidth={1}
        borderBottomColor="$border"
        gap="$xs"
      >
        <Row justifyContent="space-between" alignItems="center">
          <Heading level={2}>Messages</Heading>
          {conversations.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
            <Badge variant="primary" size="sm">
              {conversations.reduce((acc, c) => acc + c.unreadCount, 0)}
            </Badge>
          )}
        </Row>
      </Column>

      {/* Thread list */}
      {conversations.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" gap="$lg" padding="$xl">
          <Column
            backgroundColor="$backgroundHover"
            borderRadius="$full"
            width={64}
            height={64}
            alignItems="center"
            justifyContent="center"
          >
            <MessageSquare size={28} color="$textSecondary" />
          </Column>
          <Text color="$textSecondary" textAlign="center" size="$5">
            No conversations yet
          </Text>
          <Text color="$textTertiary" textAlign="center" size="$4">
            When you buy or sell items, your conversations will appear here.
          </Text>
          <Link href="/listings" style={{ textDecoration: "none" }}>
            <Text
              color="$primary"
              weight="semibold"
              hoverStyle={{ textDecorationLine: "underline" }}
            >
              Browse listings →
            </Text>
          </Link>
        </Column>
      ) : (
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <Column paddingVertical="$xs">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const hasUnread = conversation.unreadCount > 0;
              const conversationStatus = getConversationStatus(
                conversation.productSold,
                conversation.latestOfferStatus,
                conversation.lastMessageType,
                conversation.lastMessagePreview
              );

              return (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={isActive}
                  hasUnread={hasUnread}
                  conversationStatus={conversationStatus}
                  onListingPress={() => setSelectedListing(conversation)}
                  onOpenConversation={() => router.push(`/messages/${conversation.id}`)}
                />
              );
            })}
          </Column>
        </ScrollView>
      )}

      <ListingDetailsPanel
        open={selectedListing != null}
        onClose={() => setSelectedListing(null)}
        productId={selectedListing?.productId ?? ""}
        productTitle={selectedListing?.productTitle ?? ""}
        productImage={selectedListing?.productImage ?? null}
        productPrice={selectedListing?.productPrice ?? 0}
        productSold={selectedListing?.productSold ?? false}
        otherUserName={selectedListing?.otherUserName ?? ""}
      />
    </Column>
  );
}

interface ConversationRowProps {
  conversation: Conversation;
  isActive: boolean;
  hasUnread: boolean;
  conversationStatus: { label: string; color: "$warning" | "$primary" | "$success" } | null;
  onListingPress: () => void;
  onOpenConversation: () => void;
}

function ConversationRow({
  conversation,
  isActive,
  hasUnread,
  conversationStatus,
  onListingPress,
  onOpenConversation,
}: Readonly<ConversationRowProps>) {
  return (
    <Row
      gap="$md"
      paddingHorizontal="$lg"
      paddingVertical="$md"
      alignItems="center"
      backgroundColor={isActive ? "$primaryLight" : "transparent"}
      borderLeftWidth={isActive ? 3 : 0}
      borderLeftColor={isActive ? "$primary" : "transparent"}
      hoverStyle={{
        backgroundColor: isActive ? "$primaryLight" : "$backgroundHover",
      }}
      pressStyle={{
        backgroundColor: isActive ? "$primaryLight" : "$backgroundPress",
      }}
      animation="quick"
      cursor="pointer"
      onPress={onOpenConversation}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenConversation();
        }
      }}
      tabIndex={0}
      aria-label={`Open conversation with ${conversation.otherUserName}`}
    >
      <SellerQuickProfilePopover
        sellerName={conversation.otherUserName}
        sellerImageUrl={conversation.otherUserImage}
        averageRating={conversation.otherUserAverageRating}
        ratingCount={conversation.otherUserRatingCount}
        userRole={conversation.userRole}
        trigger={
          <Button
            chromeless
            padding={0}
            minHeight={0}
            height="auto"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            aria-label={`View ${conversation.otherUserName} profile details`}
            onPress={(event) => {
              event.stopPropagation();
            }}
          >
            {conversation.otherUserImage ? (
              <Image
                source={{ uri: conversation.otherUserImage }}
                width={48}
                height={48}
                borderRadius={24}
                alt={conversation.otherUserName}
              />
            ) : (
              <View
                width={48}
                height={48}
                borderRadius={24}
                backgroundColor={isActive ? "$primary" : "$border"}
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  size="$5"
                  weight="semibold"
                  color={isActive ? "$textInverse" : "$textSecondary"}
                >
                  {getInitials(conversation.otherUserName)}
                </Text>
              </View>
            )}
          </Button>
        }
      />

      <Column flex={1} gap="$xs" minWidth={0}>
        <Row alignItems="center" gap="$xs">
          <Text
            size="$5"
            weight={hasUnread ? "bold" : "medium"}
            color="$text"
            numberOfLines={1}
            flex={1}
          >
            {conversation.otherUserName}
          </Text>

          <Text size="$2" color="$textSecondary" flexShrink={0}>
            {formatDistanceToNow(new Date(conversation.lastMessageAt), {
              addSuffix: false,
            })}
          </Text>
        </Row>

        <Row alignItems="center" justifyContent="space-between" gap="$sm">
          <Button
            chromeless
            size="$1"
            paddingHorizontal="$sm"
            paddingVertical={2}
            minHeight={0}
            height="auto"
            cursor="pointer"
            onPress={(event) => {
              event.stopPropagation();
              onListingPress();
            }}
            aria-label={`View listing details for ${conversation.productTitle}`}
            maxWidth="75%"
            alignItems="flex-start"
            justifyContent="flex-start"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.7 }}
          >
            <Text size="$2" color="$textSecondary" numberOfLines={1}>
              {conversation.productTitle}
            </Text>
          </Button>

          {conversationStatus && (
            <Text size="$2" color={conversationStatus.color} weight="semibold" flexShrink={0}>
              {conversationStatus.label}
            </Text>
          )}
        </Row>

        <Row justifyContent="space-between" alignItems="center" gap="$sm">
          <Text
            size="$4"
            color={hasUnread ? "$text" : "$textSecondary"}
            weight={hasUnread ? "semibold" : "normal"}
            numberOfLines={1}
            flex={1}
          >
            {conversation.lastMessagePreview || "No messages yet"}
          </Text>

          <Row alignItems="center" gap="$xs" flexShrink={0}>
            {hasUnread && (
              <View
                backgroundColor="$primary"
                borderRadius="$full"
                minWidth={20}
                height={20}
                alignItems="center"
                justifyContent="center"
                paddingHorizontal="$xs"
              >
                <Text size="$1" color="$textInverse" weight="bold">
                  {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                </Text>
              </View>
            )}
          </Row>
        </Row>
      </Column>
    </Row>
  );
}
