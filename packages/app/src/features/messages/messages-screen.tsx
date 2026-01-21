"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Column,
  Row,
  ScrollView,
  Text,
  Heading,
  Spinner,
  Button,
  Image,
  Card,
  Badge,
} from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, ChevronRight } from "@tamagui/lucide-icons";
import { MobileBottomNav } from "../../components/mobile";
import { formatDistanceToNow } from "date-fns";

export interface Conversation {
  orderId: string;
  productTitle: string;
  productImage: string | null;
  otherUserName: string;
  otherUserImage: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  userRole: "buyer" | "seller";
  orderStatus: string;
}

interface MessagesScreenProps {
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Callback to fetch all conversations */
  onFetchConversations?: () => Promise<{
    conversations: Conversation[];
  }>;
  /** Callback when conversation is tapped - passes full conversation data */
  onConversationPress?: (conversation: Conversation) => void;
  /** Navigate to browse listings */
  onBrowseListings?: () => void;
  /** Bottom nav handlers */
  onHomePress?: () => void;
  onWishlistPress?: () => void;
  onSellPress?: () => void;
  onMessagesPress?: () => void;
  onLoginPress?: () => void;
  onAccountPress?: () => void;
}

export function MessagesScreen({
  isAuthenticated = false,
  onFetchConversations,
  onConversationPress,
  onBrowseListings,
  onHomePress,
  onWishlistPress,
  onSellPress,
  onMessagesPress,
  onLoginPress,
  onAccountPress,
}: Readonly<MessagesScreenProps>) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch conversations on mount
  useEffect(() => {
    if (!onFetchConversations) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        setError(null);
        const data = await onFetchConversations();
        if (!cancelled) {
          setConversations(data.conversations);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load messages");
          console.error("Error fetching conversations:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [onFetchConversations]);

  // Setup auto-refresh every 30 seconds
  useEffect(() => {
    if (!onFetchConversations) return;

    const interval = setInterval(async () => {
      try {
        const data = await onFetchConversations();
        setConversations(data.conversations);
      } catch (err) {
        console.error("Error refreshing conversations:", err);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [onFetchConversations]);

  const handleRefresh = useCallback(async () => {
    if (!onFetchConversations) return;

    setRefreshing(true);
    try {
      const data = await onFetchConversations();
      setConversations(data.conversations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [onFetchConversations]);

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (!isAuthenticated) {
    return (
      <Column width="100%" height="100%" paddingTop={insets.top}>
        <Column flex={1} alignItems="center" justifyContent="center" gap="$lg" paddingHorizontal="$lg">
          <MessageCircle size={64} color="$primary" />
          <Heading level={2} textAlign="center">
            Sign in to Message
          </Heading>
          <Text size="$5" color="$textSecondary" textAlign="center">
            Connect with buyers and sellers about your golf gear
          </Text>
          <Button
            size="$5"
            backgroundColor="$primary"
            color="$textInverse"
            paddingHorizontal="$6"
            borderRadius="$full"
            onPress={onLoginPress}
          >
            Sign In
          </Button>
        </Column>
        <MobileBottomNav
          activeTab="messages"
          onHomePress={onHomePress}
          onWishlistPress={onWishlistPress}
          onSellPress={onSellPress}
          onMessagesPress={onMessagesPress}
          onLoginPress={onLoginPress}
          onAccountPress={onAccountPress}
          isAuthenticated={false}
        />
      </Column>
    );
  }

  return (
    <Column width="100%" height="100%" paddingTop={insets.top}>
      <Column
        flex={1}
        gap="$md"
        paddingHorizontal="$md"
        paddingVertical="$md"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <Row alignItems="center" justifyContent="space-between">
          <Column flex={1}>
            <Heading level={1} size="$8">
              Messages
            </Heading>
            {totalUnread > 0 && (
              <Text size="$4" color="$textSecondary">
                {totalUnread} unread
              </Text>
            )}
          </Column>
          {!loading && (
            <Button
              size="$4"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$border"
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? <Spinner size="sm" /> : "Refresh"}
            </Button>
          )}
        </Row>
      </Column>

      {error && (
        <Column paddingHorizontal="$md" paddingVertical="$md" gap="$md">
          <Card backgroundColor="$error" opacity={0.1}>
            <Text color="$error" size="$4">
              {error}
            </Text>
          </Card>
        </Column>
      )}

      {loading ? (
        <Column flex={1} alignItems="center" justifyContent="center" gap="$md">
          <Spinner size="lg" color="$primary" />
          <Text color="$textSecondary">Loading messages...</Text>
        </Column>
      ) : conversations.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" gap="$lg" paddingHorizontal="$lg">
          <MessageCircle size={56} color="$textTertiary" />
          <Heading level={2} textAlign="center">
            No messages yet
          </Heading>
          <Text size="$5" color="$textSecondary" textAlign="center">
            When you buy or sell items, you'll be able to message with the other party
          </Text>
          <Button
            size="$5"
            backgroundColor="$primary"
            color="$textInverse"
            paddingHorizontal="$6"
            borderRadius="$full"
            onPress={onBrowseListings}
          >
            Browse Listings
          </Button>
        </Column>
      ) : (
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <Column gap="$md" paddingHorizontal="$md" paddingVertical="$md">
            {conversations.map((conversation) => (
              <Card
                key={conversation.orderId}
                variant="elevated"
                paddingHorizontal="$md"
                paddingVertical="$md"
                onPress={() => onConversationPress?.(conversation)}
                pressStyle={{ opacity: 0.7 }}
                cursor="pointer"
              >
                <Row gap="$md" alignItems="flex-start">
                  {/* Product Image */}
                  {conversation.productImage && (
                    <Image
                      source={{ uri: conversation.productImage }}
                      width={64}
                      height={64}
                      borderRadius="$md"
                      backgroundColor="$surface"
                    />
                  )}

                  {/* Message Content */}
                  <Column flex={1} gap="$sm">
                    <Row alignItems="center" justifyContent="space-between">
                      <Column flex={1} gap="$xs">
                        <Text size="$5" weight="bold" numberOfLines={1}>
                          {conversation.productTitle}
                        </Text>
                        <Text size="$4" color="$textSecondary" numberOfLines={1}>
                          {conversation.otherUserName}
                        </Text>
                      </Column>
                      {conversation.unreadCount > 0 && (
                        <Badge size="sm" backgroundColor="$primary">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </Row>

                    <Text
                      size="$4"
                      color="$textSecondary"
                      numberOfLines={1}
                      opacity={conversation.unreadCount > 0 ? 1 : 0.7}
                    >
                      {conversation.lastMessagePreview || "No messages yet"}
                    </Text>

                    <Row alignItems="center" justifyContent="space-between">
                      <Text size="$3" color="$textTertiary">
                        {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                      </Text>
                      <ChevronRight size={16} color="$textTertiary" />
                    </Row>
                  </Column>
                </Row>
              </Card>
            ))}
          </Column>
        </ScrollView>
      )}

      <MobileBottomNav
        activeTab="messages"
        onHomePress={onHomePress}
        onWishlistPress={onWishlistPress}
        onSellPress={onSellPress}
        onMessagesPress={onMessagesPress}
        onLoginPress={onLoginPress}
        onAccountPress={onAccountPress}
        isAuthenticated={isAuthenticated}
      />
    </Column>
  );
}
