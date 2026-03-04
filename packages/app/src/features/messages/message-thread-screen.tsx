"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import {
  Column,
  Row,
  Text,
  Image,
  ChatMessageList,
  ChatInput,
  Button,
  Popover,
} from "@buttergolf/ui";
import type { ChatMessage } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Star } from "@tamagui/lucide-icons";

const MESSAGE_LIMITS = {
  MAX_LENGTH: 2000,
  MIN_LENGTH: 1,
};

/** Map of real server IDs → temp IDs, used to keep React keys stable during
 *  the optimistic → confirmed transition so the ChatBubble doesn't
 *  unmount/remount and re-trigger its entrance animation. */
type TempIdMap = Map<string, string>;

/** Minimal interface for an EventSource-compatible connection.
 *  Web uses the native EventSource; mobile can provide react-native-sse. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: { data: string }) => void): void;
  close(): void;
}

interface MessageThreadScreenProps {
  /** Conversation ID */
  conversationId: string;
  /** Current user ID */
  currentUserId: string;
  /** Current user's role (buyer or seller) */
  userRole?: "buyer" | "seller";
  /** Other user's name */
  otherUserName: string;
  /** Other user's image URL */
  otherUserImage: string | null;
  /** Other user's average rating */
  otherUserAverageRating?: number | null;
  /** Other user's rating count */
  otherUserRatingCount?: number;
  /** Product title */
  productTitle?: string;
  /** Product image URL (shown in header) */
  productImage?: string | null;
  /** Product title press handler */
  onProductPress?: () => void;
  /** Pre-loaded messages (skips loading state) */
  initialMessages?: ChatMessage[];
  /** Callback to fetch messages for this conversation.
   *  Accepts an optional cursor for pagination (load older messages). */
  onFetchMessages?: (
    conversationId: string,
    cursor?: string
  ) => Promise<{
    messages: Array<{
      id: string;
      conversationId: string;
      senderId: string;
      senderName: string;
      senderImage: string | null;
      content: string;
      createdAt: string;
      isRead: boolean;
      senderRole?: "buyer" | "seller";
      isOwnMessage?: boolean;
      type?: string;
      offerAmount?: number | null;
      offerId?: string | null;
      offerStatus?: string | null;
    }>;
    userRole?: "buyer" | "seller";
    nextCursor?: string | null;
    hasMore?: boolean;
  }>;
  /** Callback to send a message */
  onSendMessage?: (
    conversationId: string,
    content: string
  ) => Promise<{
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderImage: string | null;
    content: string;
    createdAt: string;
    isRead: boolean;
  }>;
  /** Callback to mark messages as read */
  onMarkAsRead?: (conversationId: string) => Promise<void>;
  /** Navigate back */
  onBack?: () => void;
  /** Factory to create a realtime connection. Defaults to native EventSource on web.
   *  Mobile should pass a factory using react-native-sse with auth headers. */
  createEventSource?: (url: string) => EventSourceLike;
  /** Whether to show the offer toggle button in chat input */
  showOfferButton?: boolean;
  /** Callback to make an offer */
  onMakeOffer?: (amount: number, message?: string) => Promise<unknown>;
  /** Callback to counter an offer */
  onCounterOffer?: (amount: number, message?: string) => Promise<unknown>;
  /** Callback to accept the active offer */
  onAcceptOffer?: () => Promise<unknown>;
  /** Callback to reject the active offer */
  onRejectOffer?: () => Promise<unknown>;
}

type ChatMessageType = NonNullable<ChatMessage["type"]>;
type ChatOfferStatus = NonNullable<ChatMessage["offerStatus"]>;

const CHAT_MESSAGE_TYPES: ReadonlySet<ChatMessageType> = new Set([
  "TEXT",
  "OFFER",
  "COUNTER_OFFER",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "OFFER_EXPIRED",
  "SYSTEM",
]);

const CHAT_OFFER_STATUSES: ReadonlySet<ChatOfferStatus> = new Set([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "COUNTERED",
]);

function toChatMessageType(value: string | null | undefined): ChatMessage["type"] {
  if (!value) return undefined;
  return CHAT_MESSAGE_TYPES.has(value as ChatMessageType) ? (value as ChatMessageType) : undefined;
}

function toChatOfferStatus(value: string | null | undefined): ChatMessage["offerStatus"] {
  if (!value) return undefined;
  return CHAT_OFFER_STATUSES.has(value as ChatOfferStatus) ? (value as ChatOfferStatus) : undefined;
}

function toChatMessage(msg: {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  type?: string | null;
  offerAmount?: number | null;
  offerId?: string | null;
  offerStatus?: string | null;
}): ChatMessage {
  return {
    id: msg.id,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
    isRead: msg.isRead,
    type: toChatMessageType(msg.type),
    offerAmount: msg.offerAmount ?? undefined,
    offerId: msg.offerId ?? undefined,
    offerStatus: toChatOfferStatus(msg.offerStatus),
  };
}

export function MessageThreadScreen({
  conversationId,
  currentUserId,
  otherUserName,
  otherUserImage,
  otherUserAverageRating,
  otherUserRatingCount = 0,
  productTitle = "Order",
  productImage,
  onProductPress,
  initialMessages,
  onFetchMessages,
  onSendMessage,
  onMarkAsRead,
  createEventSource: createEventSourceProp,
  showOfferButton = false,
  onMakeOffer,
  onCounterOffer,
  onAcceptOffer,
  onRejectOffer,
}: Readonly<MessageThreadScreenProps>) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer input mode state
  const [offerMode, setOfferMode] = useState(false);
  const [isCounterMode, setIsCounterMode] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");

  // Cursor pagination state
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Failed-send state: keep the optimistic message visible, allow retry
  const [failedContent, setFailedContent] = useState<string | null>(null);
  const failedTempIdRef = useRef<string | null>(null);

  // Stable React key map: realId → tempId, so the ChatBubble doesn't
  // unmount/remount when the optimistic temp ID is replaced with the server ID.
  const stableKeyMapRef = useRef<TempIdMap>(new Map());

  // Tracks whether Realtime is currently connected (diagnostics only)
  const realtimeConnectedRef = useRef(false);
  const isWeb = Platform.OS === "web";

  const isOverLimit = newMessage.length > MESSAGE_LIMITS.MAX_LENGTH;

  /** Look up the stable React key for a message. Optimistic messages keep
   *  their original temp-based key even after the server ID is swapped in. */
  const getStableKey = useCallback((msg: ChatMessage) => {
    return stableKeyMapRef.current.get(msg.id) ?? msg.id;
  }, []);

  // Merge incoming messages from polling/SSE with id-based upsert semantics.
  // This ensures DB refreshes can repair state after remounts while preserving
  // optimistic temp rows that have not been confirmed yet.
  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      if (incoming.length === 0) return prev;

      const byId = new Map(prev.map((m) => [m.id, m]));
      let changed = false;

      for (const msg of incoming) {
        const existing = byId.get(msg.id);
        if (!existing) {
          byId.set(msg.id, msg);
          changed = true;
          continue;
        }

        if (
          existing.content !== msg.content ||
          existing.isRead !== msg.isRead ||
          existing.createdAt !== msg.createdAt ||
          existing.senderId !== msg.senderId ||
          existing.type !== msg.type ||
          existing.offerAmount !== msg.offerAmount ||
          existing.offerId !== msg.offerId ||
          existing.offerStatus !== msg.offerStatus
        ) {
          byId.set(msg.id, msg);
          changed = true;
        }
      }

      if (!changed) return prev;

      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  // Load older messages (cursor pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!onFetchMessages || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await onFetchMessages(conversationId, nextCursor);
      const older = data.messages.map(toChatMessage);
      // Prepend older messages
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !existingIds.has(m.id));
        return unique.length === 0 ? prev : [...unique, ...prev];
      });
      setHasMore(data.hasMore ?? false);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // Silent — don't surface pagination errors to the user
    } finally {
      setLoadingMore(false);
    }
  }, [onFetchMessages, conversationId, nextCursor, loadingMore]);

  // Fetch initial messages and setup SSE
  useEffect(() => {
    let cancelled = false;

    const fetchAndSetup = async () => {
      try {
        // Always re-sync from DB on mount, even when initialMessages were
        // server-rendered, because layout remounts can provide stale props.
        if (onFetchMessages) {
          const data = await onFetchMessages(conversationId);
          if (!cancelled) {
            mergeMessages(data.messages.map(toChatMessage));
            setHasMore(data.hasMore ?? false);
            setNextCursor(data.nextCursor ?? null);
          }
        }

        if (onMarkAsRead && !cancelled) {
          await onMarkAsRead(conversationId).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load messages");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAndSetup();

    // Setup realtime stream for messages with auto-reconnect.
    // Uses createEventSource factory if provided (mobile/Supabase), falls back
    // to native EventSource (web). Reconnects with exponential backoff on failure.
    const channelUrl = `/api/conversations/${conversationId}/messages/stream`;
    let currentSource: EventSourceLike | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000; // Start at 1s, double each attempt, cap at 30s
    const MAX_RECONNECT_DELAY = 30000;

    const handleMessage = (event: { data: string }) => {
      try {
        const data = JSON.parse(event.data);
        const legacyBareMessage =
          data &&
          typeof data === "object" &&
          typeof data.id === "string" &&
          typeof data.senderId === "string" &&
          typeof data.content === "string" &&
          typeof data.createdAt === "string";

        if (data.type === "new_message" && data.message && !cancelled) {
          // Skip self-echoed messages — our optimistic update already
          // handles the sender's own messages.
          if (data.message.senderId === currentUserId) return;

          mergeMessages([toChatMessage(data.message)]);
        } else if (legacyBareMessage && !cancelled) {
          // Backward compatibility for older realtime payloads that broadcast
          // a bare message object without the { type, message } envelope.
          if (data.senderId === currentUserId) return;
          mergeMessages([toChatMessage(data)]);
        } else if (data.type === "offer_update" && data.offerId && !cancelled) {
          const updatedStatus = toChatOfferStatus(
            typeof data.status === "string" ? data.status : undefined
          );
          const updatedAmount = typeof data.amount === "number" ? data.amount : undefined;

          if (updatedStatus || updatedAmount != null) {
            setMessages((prev) => {
              let changed = false;
              const next = prev.map((m) => {
                if (m.offerId !== data.offerId) return m;

                const nextStatus = updatedStatus ?? m.offerStatus;
                const nextAmount = updatedAmount ?? m.offerAmount;

                if (nextStatus === m.offerStatus && nextAmount === m.offerAmount) {
                  return m;
                }

                changed = true;
                return {
                  ...m,
                  offerStatus: nextStatus,
                  offerAmount: nextAmount,
                };
              });

              return changed ? next : prev;
            });
          }
        } else if (data.type === "messages_read" && !cancelled) {
          // The other party read our messages — update isRead for all
          // messages we sent that are still marked unread.
          if (data.readerId !== currentUserId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.senderId === currentUserId && !m.isRead ? { ...m, isRead: true } : m
              )
            );
          }
        }
        // Any successful message resets the backoff
        reconnectDelay = 1000;
        realtimeConnectedRef.current = true;
      } catch {
        // Ignore heartbeat comments and malformed events
      }
    };

    const connect = () => {
      if (cancelled) return;
      currentSource?.close();

      let es: EventSourceLike | null = null;
      if (createEventSourceProp) {
        es = createEventSourceProp(channelUrl);
      } else if (typeof window !== "undefined" && window.EventSource) {
        es = new EventSource(channelUrl);
      }

      if (!es) return;
      currentSource = es;
      // Don't set realtimeConnectedRef here — wait for the 'connected' event
      // from the adapter, which confirms the channel is actually subscribed.

      es.addEventListener("message", handleMessage);
      es.addEventListener("error", () => {
        if (cancelled) return;
        realtimeConnectedRef.current = false;
        currentSource?.close();
        currentSource = null;
        // Schedule reconnect with exponential backoff
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        reconnectTimer = setTimeout(() => {
          connect();
        }, reconnectDelay);
      });
    };

    connect();

    return () => {
      cancelled = true;
      realtimeConnectedRef.current = false;
      currentSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    // is intentionally read from a ref so that a new server-side array
    // reference does not tear down and recreate the realtime connection.
  }, [
    conversationId,
    currentUserId,
    onFetchMessages,
    onMarkAsRead,
    mergeMessages,
    createEventSourceProp,
  ]);

  // 10-second polling sync — always enabled to guarantee eventual consistency
  // from database state across remounts/network mode changes.
  useEffect(() => {
    if (!onFetchMessages) return;

    const interval = setInterval(async () => {
      try {
        const data = await onFetchMessages(conversationId);
        mergeMessages(data.messages.map(toChatMessage));
      } catch {
        // Silent — polling failures don't surface to the user
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [conversationId, onFetchMessages, mergeMessages]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending || isOverLimit) return;

    setSending(true);
    setError(null);
    setFailedContent(null);
    failedTempIdRef.current = null;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderId: currentUserId,
      content,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      if (onSendMessage) {
        const message = await onSendMessage(conversationId, content);

        // Record the stable key so ChatMessageList keeps the same React key
        // for this message (avoids unmount/remount animation glitch).
        stableKeyMapRef.current.set(message.id, tempId);

        setMessages((prev) => {
          // If SSE or polling already delivered this message (race condition),
          // just remove the temp entry instead of creating a duplicate.
          const realAlreadyExists = prev.some((m) => m.id === message.id);
          if (realAlreadyExists) {
            return prev.filter((m) => m.id !== tempId);
          }

          const tempStillExists = prev.some((m) => m.id === tempId);

          // Normal path — swap the temp placeholder with confirmed data.
          if (tempStillExists) {
            return prev.map((m) =>
              m.id === tempId
                ? {
                    id: message.id,
                    senderId: message.senderId,
                    content: message.content,
                    createdAt: message.createdAt,
                    isRead: message.isRead,
                  }
                : m
            );
          }

          // Component may have remounted before POST resolved (e.g. layout/media
          // switch). In that case the temp row is gone — append confirmed message.
          return [
            ...prev,
            {
              id: message.id,
              senderId: message.senderId,
              content: message.content,
              createdAt: message.createdAt,
              isRead: message.isRead,
            },
          ];
        });
      }
    } catch (err) {
      // Keep the optimistic message visible — never remove it on failure.
      // Store what failed so the user can retry without retyping.
      failedTempIdRef.current = tempId;
      setFailedContent(content);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, isOverLimit, conversationId, currentUserId, onSendMessage]);

  const handleSendOffer = useCallback(
    async (amount: number, message?: string) => {
      const callback = isCounterMode ? onCounterOffer : onMakeOffer;
      if (!callback || sending) return;
      setSending(true);
      setError(null);

      try {
        await callback(amount, message);
        setOfferMode(false);
        setIsCounterMode(false);
        setOfferAmount("");
        setNewMessage("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isCounterMode
              ? "Failed to submit counter offer"
              : "Failed to make offer"
        );
      } finally {
        setSending(false);
      }
    },
    [isCounterMode, onCounterOffer, onMakeOffer, sending]
  );

  const handleAcceptOffer = useCallback(
    async (_offerId: string) => {
      if (!onAcceptOffer) return;
      try {
        await onAcceptOffer();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept offer");
      }
    },
    [onAcceptOffer]
  );

  const handleRejectOffer = useCallback(
    async (_offerId: string) => {
      if (!onRejectOffer) return;
      try {
        await onRejectOffer();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject offer");
      }
    },
    [onRejectOffer]
  );

  const handleCounterOffer = useCallback(async (_offerId: string) => {
    setOfferMode(true);
    setIsCounterMode(true);
  }, []);

  const handleRetry = useCallback(() => {
    if (!failedContent) return;
    // Remove the stuck optimistic message and re-populate the input
    setMessages((prev) => prev.filter((m) => m.id !== failedTempIdRef.current));
    setNewMessage(failedContent);
    setFailedContent(null);
    failedTempIdRef.current = null;
    setError(null);
  }, [failedContent]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, width: "100%" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Column width="100%" height="100%" paddingTop={insets.top} backgroundColor="$background">
        {/* Header */}
        <Row
          alignItems="center"
          gap="$sm"
          paddingHorizontal="$sm"
          paddingVertical="$sm"
          borderBottomWidth={1}
          borderBottomColor="$border"
          backgroundColor="$surface"
        >
          {isWeb ? (
            <Popover placement="bottom" offset={10}>
              <Popover.Trigger asChild>
                <Button
                  chromeless
                  padding={0}
                  minHeight={0}
                  height="auto"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  aria-label={`View ${otherUserName} profile details`}
                >
                  <Column width={44} height={44} position="relative">
                    {otherUserImage ? (
                      <Image
                        source={{ uri: otherUserImage }}
                        width={44}
                        height={44}
                        borderRadius={22}
                        alt={otherUserName}
                      />
                    ) : (
                      <Column
                        width={44}
                        height={44}
                        borderRadius={22}
                        backgroundColor="$backgroundHover"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text size="$6" fontWeight="700" color="$textSecondary">
                          {otherUserName?.charAt(0)?.toUpperCase() || "?"}
                        </Text>
                      </Column>
                    )}
                    {productImage && (
                      <Image
                        source={{ uri: productImage }}
                        width={22}
                        height={22}
                        borderRadius={4}
                        alt={productTitle}
                        position="absolute"
                        bottom={-2}
                        right={-4}
                        borderWidth={2}
                        borderColor="$surface"
                      />
                    )}
                  </Column>
                </Button>
              </Popover.Trigger>

              <Popover.Content
                backgroundColor="$surface"
                borderRadius="$lg"
                padding="$4"
                borderWidth={1}
                borderColor="$border"
                elevate
                boxShadow="0px 12px 30px rgba(0, 0, 0, 0.16)"
              >
                <Popover.Arrow
                  size="$2"
                  offset={8}
                  borderWidth={1}
                  borderColor="$border"
                  backgroundColor="$surface"
                />

                <Column gap="$2" width={240}>
                  <Text size="$5" weight="semibold" color="$text" numberOfLines={1}>
                    {otherUserName}
                  </Text>
                  <Row alignItems="center" gap="$xs">
                    <Star size={14} color="$warning" />
                    <Text size="$3" color="$text">
                      {otherUserAverageRating && otherUserAverageRating > 0
                        ? otherUserAverageRating.toFixed(1)
                        : "New seller"}
                    </Text>
                    {otherUserRatingCount > 0 && (
                      <Text size="$3" color="$textSecondary">
                        ({otherUserRatingCount} ratings)
                      </Text>
                    )}
                  </Row>
                </Column>
              </Popover.Content>
            </Popover>
          ) : (
            <Column width={44} height={44} position="relative">
              {otherUserImage ? (
                <Image
                  source={{ uri: otherUserImage }}
                  width={44}
                  height={44}
                  borderRadius={22}
                  alt={otherUserName}
                />
              ) : (
                <Column
                  width={44}
                  height={44}
                  borderRadius={22}
                  backgroundColor="$backgroundHover"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text size="$6" fontWeight="700" color="$textSecondary">
                    {otherUserName?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </Column>
              )}
              {productImage && (
                <Image
                  source={{ uri: productImage }}
                  width={22}
                  height={22}
                  borderRadius={4}
                  alt={productTitle}
                  position="absolute"
                  bottom={-2}
                  right={-4}
                  borderWidth={2}
                  borderColor="$surface"
                />
              )}
            </Column>
          )}

          <Column flex={1} gap={2}>
            <Text size="$5" fontWeight="600" numberOfLines={1}>
              {otherUserName}
            </Text>
            {onProductPress ? (
              <Button
                chromeless
                padding={0}
                minHeight={0}
                height="auto"
                alignSelf="flex-start"
                onPress={onProductPress}
                cursor={isWeb ? "pointer" : undefined}
              >
                <Text
                  size="$3"
                  color="$textSecondary"
                  numberOfLines={1}
                  hoverStyle={isWeb ? { textDecorationLine: "underline" } : undefined}
                >
                  {productTitle}
                </Text>
              </Button>
            ) : (
              <Text size="$3" color="$textSecondary" numberOfLines={1}>
                {productTitle}
              </Text>
            )}
          </Column>
        </Row>

        {/* Error / Retry Banner */}
        {error && (
          <Row
            backgroundColor="$errorLight"
            paddingHorizontal="$md"
            paddingVertical="$sm"
            alignItems="center"
            gap="$sm"
          >
            <Text size="$3" color="$error" flex={1}>
              {error}
            </Text>
            {failedContent ? (
              <Text
                size="$3"
                color="$error"
                weight="semibold"
                cursor="pointer"
                onPress={handleRetry}
              >
                Retry
              </Text>
            ) : (
              <Text
                size="$3"
                color="$error"
                weight="semibold"
                cursor="pointer"
                onPress={() => setError(null)}
              >
                Dismiss
              </Text>
            )}
          </Row>
        )}

        {/* Messages (scrollable region) */}
        <Column flex={1} minHeight={0}>
          <ChatMessageList
            messages={messages}
            currentUserId={currentUserId}
            otherUserName={otherUserName}
            otherUserImage={otherUserImage}
            loading={loading}
            emptyMessage={`Start a conversation with ${otherUserName}`}
            getStableKey={getStableKey}
            onLoadMore={hasMore ? loadOlderMessages : undefined}
            loadingMore={loadingMore}
            onAcceptOffer={handleAcceptOffer}
            onRejectOffer={handleRejectOffer}
            onCounterOffer={handleCounterOffer}
          />
        </Column>

        {/* Input */}
        <Column marginTop="auto" flexShrink={0} paddingBottom={Math.max(insets.bottom, 8)}>
          <ChatInput
            value={newMessage}
            onChangeText={setNewMessage}
            onSend={handleSend}
            sending={sending}
            maxLength={MESSAGE_LIMITS.MAX_LENGTH}
            showOfferButton={showOfferButton}
            offerMode={offerMode}
            isCounterMode={isCounterMode}
            onToggleOfferMode={() => {
              setOfferMode((prev) => !prev);
              setIsCounterMode(false);
              setOfferAmount("");
            }}
            offerAmount={offerAmount}
            onOfferAmountChange={setOfferAmount}
            onSendOffer={handleSendOffer}
          />
        </Column>
      </Column>
    </KeyboardAvoidingView>
  );
}
