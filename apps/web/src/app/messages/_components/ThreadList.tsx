"use client";

import Link from "next/link";
import { Column, Row, Text, Heading, Badge, ScrollView } from "@buttergolf/ui";
import { View, Image } from "tamagui";
import { MessageSquare } from "@tamagui/lucide-icons";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "../MessagesLayout";
import { ThreadListSkeleton } from "./ThreadListSkeleton";

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
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  style={{ textDecoration: "none" }}
                >
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
                    cursor="pointer"
                    animation="quick"
                  >
                    {/* Avatar */}
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

                    {/* Content */}
                    <Column flex={1} gap={2}>
                      <Row justifyContent="space-between" alignItems="center">
                        <Text
                          size="$5"
                          weight={hasUnread ? "bold" : "medium"}
                          color="$text"
                          numberOfLines={1}
                          flex={1}
                        >
                          {conversation.otherUserName}
                        </Text>
                        <Text size="$2" color="$textSecondary">
                          {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                            addSuffix: false,
                          })}
                        </Text>
                      </Row>

                      <Text size="$3" color="$textSecondary" numberOfLines={1}>
                        {conversation.productTitle}
                      </Text>

                      {offerBadge && (
                        <Row alignItems="center" gap="$xs">
                          <Badge variant={offerBadge.variant} size="sm">
                            {offerBadge.label}
                            {conversation.activeOfferAmount != null
                              ? ` £${conversation.activeOfferAmount.toFixed(2)}`
                              : ""}
                          </Badge>
                        </Row>
                      )}

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
                    </Column>
                  </Row>
                </Link>
              );
            })}
          </Column>
        </ScrollView>
      )}
    </Column>
  );
}
