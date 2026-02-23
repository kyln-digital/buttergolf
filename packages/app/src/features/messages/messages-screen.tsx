"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { FlatList, RefreshControl, Platform } from "react-native";
import { Column, Row, Text, Heading, Spinner, Button, ConversationListItem } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, AlertTriangle, RefreshCw } from "@tamagui/lucide-icons";
import { MobileBottomNav } from "../../components/mobile";
import { formatDistanceToNow } from "date-fns";

export interface Conversation {
  id: string;
  orderId?: string;
  productTitle: string;
  productImage: string | null;
  otherUserName: string;
  otherUserImage: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  userRole: "buyer" | "seller";
  orderStatus?: string;
  activeOfferStatus?: string;
  activeOfferAmount?: number;
  productSold?: boolean;
}

interface MessagesScreenProps {
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Callback to fetch conversations. Accepts an optional page number. */
  onFetchConversations?: (page?: number) => Promise<{
    conversations: Conversation[];
    hasMore?: boolean;
    page?: number;
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

function formatTimestamp(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return "";
  }
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
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Keep a stable ref to the fetch callback so effects don't re-fire on every render
  const fetchRef = useRef(onFetchConversations);
  useEffect(() => {
    fetchRef.current = onFetchConversations;
  }, [onFetchConversations]);

  const loadConversations = useCallback(async () => {
    const fetcher = fetchRef.current;
    if (!fetcher) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await fetcher();
      setConversations(data.conversations);
      setHasMore(data.hasMore ?? false);
      setCurrentPage(1);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed to load messages";
      // Show a user-friendly message, not raw API responses
      setError(raw.length > 120 ? "Unable to load messages. Please try again." : raw);
      console.error("Error fetching conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch conversations once on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Setup auto-refresh every 30 seconds (uses ref so interval is stable)
  useEffect(() => {
    const interval = setInterval(async () => {
      const fetcher = fetchRef.current;
      if (!fetcher) return;
      try {
        const data = await fetcher();
        setConversations(data.conversations);
      } catch (err) {
        console.error("Error refreshing conversations:", err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setLoading(true);
    await loadConversations();
    setRetrying(false);
  }, [loadConversations]);

  const handleRefresh = useCallback(async () => {
    const fetcher = fetchRef.current;
    if (!fetcher) return;

    setRefreshing(true);
    try {
      const data = await fetcher();
      setConversations(data.conversations);
      setHasMore(data.hasMore ?? false);
      setCurrentPage(1);
      setError(null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed to refresh";
      setError(raw.length > 120 ? "Unable to load messages. Please try again." : raw);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    const fetcher = fetchRef.current;
    if (!fetcher || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await fetcher(nextPage);
      setConversations((prev) => [...prev, ...data.conversations]);
      setHasMore(data.hasMore ?? false);
      setCurrentPage(nextPage);
    } catch {
      // Silent — pagination errors don't surface
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, currentPage]);

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const renderConversationItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationListItem
        productImage={item.productImage}
        productTitle={item.productTitle}
        otherUserName={item.otherUserName}
        otherUserImage={item.otherUserImage}
        lastMessage={item.lastMessagePreview}
        timestamp={formatTimestamp(item.lastMessageAt)}
        unreadCount={item.unreadCount}
        userRole={item.userRole}
        activeOfferStatus={item.activeOfferStatus}
        activeOfferAmount={item.activeOfferAmount}
        productSold={item.productSold}
        onPress={() => onConversationPress?.(item)}
      />
    ),
    [onConversationPress]
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  if (!isAuthenticated) {
    return (
      <Column width="100%" height="100%" paddingTop={insets.top} backgroundColor="$background">
        <Column
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$lg"
          paddingHorizontal="$lg"
        >
          <Column
            width={80}
            height={80}
            borderRadius={40}
            backgroundColor="$backgroundHover"
            alignItems="center"
            justifyContent="center"
          >
            <MessageCircle size={40} color="$primary" />
          </Column>
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
    <Column width="100%" height="100%" paddingTop={insets.top} backgroundColor="$background">
      {/* Header */}
      <Column paddingHorizontal="$lg" paddingTop="$md" paddingBottom="$sm">
        <Row alignItems="baseline" gap="$sm">
          <Heading level={1} size="$10">
            Messages
          </Heading>
          {totalUnread > 0 && (
            <Column
              backgroundColor="$primary"
              borderRadius="$full"
              minWidth={24}
              height={24}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal="$xs"
            >
              <Text size="$2" color="$textInverse" fontWeight="700">
                {totalUnread > 99 ? "99+" : totalUnread}
              </Text>
            </Column>
          )}
        </Row>
      </Column>

      {/* Content */}
      {loading ? (
        <Column flex={1} alignItems="center" justifyContent="center" gap="$md">
          <Spinner size="lg" color="$primary" />
          <Text color="$textSecondary" size="$4">
            Loading messages...
          </Text>
        </Column>
      ) : error && conversations.length === 0 ? (
        <Column
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$lg"
          paddingHorizontal="$xl"
        >
          <Column
            width={80}
            height={80}
            borderRadius={40}
            backgroundColor="$errorLight"
            alignItems="center"
            justifyContent="center"
          >
            <AlertTriangle size={40} color="$error" />
          </Column>
          <Heading level={3} textAlign="center">
            Something went wrong
          </Heading>
          <Text size="$5" color="$textSecondary" textAlign="center">
            {"We couldn't load your messages. Check your connection and try again."}
          </Text>
          <Button
            size="$5"
            backgroundColor="$primary"
            color="$textInverse"
            paddingHorizontal="$6"
            borderRadius="$full"
            onPress={handleRetry}
            disabled={retrying}
            opacity={retrying ? 0.6 : 1}
          >
            {retrying ? "Retrying..." : "Try Again"}
          </Button>
        </Column>
      ) : conversations.length === 0 ? (
        <Column
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$lg"
          paddingHorizontal="$xl"
        >
          <Column
            width={80}
            height={80}
            borderRadius={40}
            backgroundColor="$backgroundHover"
            alignItems="center"
            justifyContent="center"
          >
            <MessageCircle size={40} color="$textTertiary" />
          </Column>
          <Heading level={3} textAlign="center">
            No messages yet
          </Heading>
          <Text size="$5" color="$textSecondary" textAlign="center">
            {"When you buy or sell items, you'll be able to message with the other party"}
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
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={keyExtractor}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#F45314"
              colors={["#F45314"]}
            />
          }
          onEndReached={hasMore ? handleLoadMore : undefined}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <Column alignItems="center" paddingVertical="$md">
                <Spinner size="sm" color="$primary" />
              </Column>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={Platform.OS === "web" ? { paddingBottom: 16 } : undefined}
        />
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
