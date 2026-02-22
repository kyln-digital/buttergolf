"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Column, Row, Text, Button, View, Image, ChatMessageList, ChatInput } from "@buttergolf/ui";
import type { ChatMessage } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "@tamagui/lucide-icons";

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
  /** Order ID for this conversation */
  orderId: string;
  /** Current user ID */
  currentUserId: string;
  /** Current user's role (buyer or seller) */
  userRole?: "buyer" | "seller";
  /** Other user's name */
  otherUserName: string;
  /** Other user's image URL */
  otherUserImage: string | null;
  /** Product title */
  productTitle?: string;
  /** Product image URL (shown in header) */
  productImage?: string | null;
  /** Pre-loaded messages (skips loading state) */
  initialMessages?: ChatMessage[];
  /** Callback to fetch messages for this order.
   *  Accepts an optional cursor for pagination (load older messages). */
  onFetchMessages?: (
    orderId: string,
    cursor?: string
  ) => Promise<{
    messages: Array<{
      id: string;
      orderId: string;
      senderId: string;
      senderName: string;
      senderImage: string | null;
      content: string;
      createdAt: string;
      isRead: boolean;
      senderRole?: "buyer" | "seller";
      isOwnMessage?: boolean;
    }>;
    userRole?: "buyer" | "seller";
    nextCursor?: string | null;
    hasMore?: boolean;
  }>;
  /** Callback to send a message */
  onSendMessage?: (
    orderId: string,
    content: string
  ) => Promise<{
    id: string;
    orderId: string;
    senderId: string;
    senderName: string;
    senderImage: string | null;
    content: string;
    createdAt: string;
    isRead: boolean;
  }>;
  /** Callback to mark messages as read */
  onMarkAsRead?: (orderId: string) => Promise<void>;
  /** Navigate back */
  onBack?: () => void;
  /** Factory to create an SSE connection. Defaults to native EventSource on web.
   *  Mobile should pass a factory using react-native-sse with auth headers. */
  createEventSource?: (url: string) => EventSourceLike;
}

export function MessageThreadScreen({
  orderId,
  currentUserId,
  otherUserName,
  otherUserImage,
  productTitle = "Order",
  productImage,
  initialMessages,
  onFetchMessages,
  onSendMessage,
  onMarkAsRead,
  onBack,
  createEventSource: createEventSourceProp,
}: Readonly<MessageThreadScreenProps>) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Ref to avoid re-running the setup effect when initialMessages reference changes
  const initialMessagesRef = useRef(initialMessages);

  // Tracks whether SSE is currently connected (used by polling to skip when SSE is active)
  const sseConnectedRef = useRef(false);

  const isOverLimit = newMessage.length > MESSAGE_LIMITS.MAX_LENGTH;

  /** Look up the stable React key for a message. Optimistic messages keep
   *  their original temp-based key even after the server ID is swapped in. */
  const getStableKey = useCallback((msg: ChatMessage) => {
    return stableKeyMapRef.current.get(msg.id) ?? msg.id;
  }, []);

  // Merge incoming messages from polling/SSE — deduplicates by ID
  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newOnes = incoming.filter((m) => !existingIds.has(m.id));
      return newOnes.length === 0 ? prev : [...prev, ...newOnes];
    });
  }, []);

  // Load older messages (cursor pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!onFetchMessages || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await onFetchMessages(orderId, nextCursor);
      const older = data.messages.map((msg) => ({
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        createdAt: msg.createdAt,
        isRead: msg.isRead,
      }));
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
  }, [onFetchMessages, orderId, nextCursor, loadingMore]);

  // Fetch initial messages and setup SSE
  useEffect(() => {
    let cancelled = false;

    const fetchAndSetup = async () => {
      try {
        if (onFetchMessages && !initialMessagesRef.current) {
          const data = await onFetchMessages(orderId);
          if (!cancelled) {
            setMessages(
              data.messages.map((msg) => ({
                id: msg.id,
                senderId: msg.senderId,
                content: msg.content,
                createdAt: msg.createdAt,
                isRead: msg.isRead,
              }))
            );
            setHasMore(data.hasMore ?? false);
            setNextCursor(data.nextCursor ?? null);
          }
        }

        if (onMarkAsRead && !cancelled) {
          await onMarkAsRead(orderId).catch(() => {});
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

    // Setup SSE stream for real-time messages with auto-reconnect.
    // Uses createEventSource factory if provided (mobile), falls back to
    // native EventSource (web). Reconnects with exponential backoff on failure.
    const sseUrl = `/api/orders/${orderId}/messages/stream`;
    let currentSource: EventSourceLike | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000; // Start at 1s, double each attempt, cap at 30s
    const MAX_RECONNECT_DELAY = 30000;

    const handleMessage = (event: { data: string }) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message" && data.message && !cancelled) {
          // Skip self-echoed messages — our optimistic update already
          // handles the sender's own messages.
          if (data.message.senderId === currentUserId) return;

          mergeMessages([
            {
              id: data.message.id,
              senderId: data.message.senderId,
              content: data.message.content,
              createdAt: data.message.createdAt,
              isRead: data.message.isRead,
            },
          ]);
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
        sseConnectedRef.current = true;
      } catch {
        // Ignore heartbeat comments and malformed events
      }
    };

    const connect = () => {
      if (cancelled) return;
      currentSource?.close();

      let es: EventSourceLike | null = null;
      if (createEventSourceProp) {
        es = createEventSourceProp(sseUrl);
      } else if (typeof window !== "undefined" && window.EventSource) {
        es = new EventSource(sseUrl);
      }

      if (!es) return;
      currentSource = es;
      // Don't set sseConnectedRef here — wait for the 'connected' event
      // from the adapter, which confirms the channel is actually subscribed.

      es.addEventListener("message", handleMessage);
      es.addEventListener("error", () => {
        if (cancelled) return;
        sseConnectedRef.current = false;
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
      sseConnectedRef.current = false;
      currentSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialMessages
    // is intentionally read from a ref so that a new server-side array
    // reference does not tear down and recreate the SSE connection.
  }, [orderId, currentUserId, onFetchMessages, onMarkAsRead, mergeMessages, createEventSourceProp]);

  // 10-second polling fallback — delivers messages when SSE/Redis is unavailable.
  // Skipped when SSE is active (sseConnectedRef) to avoid redundant network requests.
  useEffect(() => {
    if (!onFetchMessages) return;

    const interval = setInterval(async () => {
      if (sseConnectedRef.current) return; // SSE is handling real-time delivery
      try {
        const data = await onFetchMessages(orderId);
        mergeMessages(
          data.messages.map((msg) => ({
            id: msg.id,
            senderId: msg.senderId,
            content: msg.content,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
          }))
        );
      } catch {
        // Silent — polling failures don't surface to the user
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId, onFetchMessages, mergeMessages]);

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
        const message = await onSendMessage(orderId, content);

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

          // Normal path — swap the temp placeholder with confirmed data.
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
  }, [newMessage, sending, isOverLimit, orderId, currentUserId, onSendMessage]);

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
    <Column width="100%" height="100%" paddingTop={insets.top} backgroundColor="$background">
      {/* Header */}
      <Row
        alignItems="center"
        gap="$md"
        paddingHorizontal="$md"
        paddingVertical="$md"
        borderBottomWidth={1}
        borderBottomColor="$border"
        backgroundColor="$surface"
      >
        <Button
          size="$4"
          backgroundColor="transparent"
          borderWidth={0}
          onPress={onBack}
          paddingHorizontal="$md"
        >
          <ArrowLeft size={24} color="$text" />
        </Button>

        {productImage && (
          <Image
            source={{ uri: productImage }}
            width={40}
            height={40}
            borderRadius="$md"
            alt={productTitle}
          />
        )}

        <Column flex={1} gap="$xs">
          <Text size="$6" weight="bold" numberOfLines={1}>
            {productTitle}
          </Text>
          <Text size="$4" color="$textSecondary" numberOfLines={1}>
            {otherUserName}
          </Text>
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
            <Text size="$3" color="$error" weight="semibold" cursor="pointer" onPress={handleRetry}>
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

      {/* Messages */}
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
      />

      {/* Input */}
      <Column paddingBottom={Math.max(insets.bottom, 8)}>
        <ChatInput
          value={newMessage}
          onChangeText={setNewMessage}
          onSend={handleSend}
          sending={sending}
          maxLength={MESSAGE_LIMITS.MAX_LENGTH}
        />
      </Column>
    </Column>
  );
}
