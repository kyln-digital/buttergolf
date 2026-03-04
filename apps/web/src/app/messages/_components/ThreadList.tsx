"use client";

import { useState } from "react";
import Link from "next/link";
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

function getOfferBadge(
  status: string | null
): { label: string; variant: "warning" | "primary" } | null {
  switch (status) {
    case "PENDING":
      return { label: "Offer", variant: "warning" };
    case "COUNTERED":
      return { label: "Counter", variant: "primary" };
    default:
      return null;
  }
}

export function ThreadList({ conversations, activeConversationId, loading }: ThreadListProps) {
  const [selectedListing, setSelectedListing] = useState<Conversation | null>(null);

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
              const offerBadge = getOfferBadge(conversation.activeOfferStatus);

              return (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={isActive}
                  hasUnread={hasUnread}
                  offerBadge={offerBadge}
                  onListingPress={() => setSelectedListing(conversation)}
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
  offerBadge: { label: string; variant: "warning" | "primary" } | null;
  onListingPress: () => void;
}

function ConversationRow({
  conversation,
  isActive,
  hasUnread,
  offerBadge,
  onListingPress,
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
            size="$2"
            paddingHorizontal="$xs"
            paddingVertical={2}
            borderRadius="$full"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$surface"
            cursor="pointer"
            onPress={onListingPress}
            hoverStyle={{ backgroundColor: "$backgroundHover", borderColor: "$borderHover" }}
            pressStyle={{ backgroundColor: "$backgroundPress" }}
            aria-label={`View listing details for ${conversation.productTitle}`}
            maxWidth="75%"
          >
            <Text size="$2" color="$textSecondary" numberOfLines={1}>
              {conversation.productTitle}
            </Text>
          </Button>

          {conversation.productSold && (
            <Text size="$2" color="$warning" weight="semibold" flexShrink={0}>
              Sold
            </Text>
          )}
        </Row>

        <Row justifyContent="space-between" alignItems="center" gap="$sm">
          <Link href={`/messages/${conversation.id}`} style={{ textDecoration: "none", flex: 1 }}>
            <Text
              size="$4"
              color={hasUnread ? "$text" : "$textSecondary"}
              weight={hasUnread ? "semibold" : "normal"}
              numberOfLines={1}
              flex={1}
            >
              {conversation.lastMessagePreview || "No messages yet"}
            </Text>
          </Link>

          <Row alignItems="center" gap="$xs" flexShrink={0}>
            {offerBadge && (
              <Badge variant={offerBadge.variant} size="sm">
                <Text
                  size="$1"
                  weight="semibold"
                  color={offerBadge.variant === "primary" ? "$textInverse" : "$text"}
                >
                  {offerBadge.label}
                </Text>
              </Badge>
            )}

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
