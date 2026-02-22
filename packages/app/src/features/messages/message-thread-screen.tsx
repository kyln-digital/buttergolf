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
  /** Callback to fetch messages for this order */
  onFetchMessages?: (orderId: string) => Promise<{
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
}: Readonly<MessageThreadScreenProps>) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Failed-send state: keep the optimistic message visible, allow retry
  const [failedContent, setFailedContent] = useState<string | null>(null);
  const failedTempIdRef = useRef<string | null>(null);

  // Stable React key map: realId → tempId, so the ChatBubble doesn't
  // unmount/remount when the optimistic temp ID is replaced with the server ID.
  const stableKeyMapRef = useRef<TempIdMap>(new Map());

  // Ref to avoid re-running the setup effect when initialMessages reference changes
  const initialMessagesRef = useRef(initialMessages);

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

    // Setup SSE stream for real-time messages (web-only).
    // The stream now runs in heartbeat-only mode when Redis is unavailable,
    // so it will never fail with a 500 or cause a reconnect loop.
    let eventSource: EventSource | null = null;
    if (typeof window !== "undefined" && window.EventSource) {
      eventSource = new EventSource(`/api/orders/${orderId}/messages/stream`);

      eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && data.message && !cancelled) {
            // Skip self-echoed messages — our optimistic update already
            // handles the sender's own messages. Without this guard the
            // SSE-delivered copy (with the real server ID) creates a
            // duplicate of the temp-ID optimistic message, and the
            // subsequent temp→real ID replacement leaves two items with
            // the same key which confuses React's reconciliation.
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
          }
        } catch {
          // Ignore heartbeat comments and malformed events
        }
      });
    }

    return () => {
      cancelled = true;
      eventSource?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialMessages
    // is intentionally read from a ref so that a new server-side array
    // reference does not tear down and recreate the SSE connection.
  }, [orderId, currentUserId, onFetchMessages, onMarkAsRead, mergeMessages]);

  // 10-second polling fallback — delivers messages when SSE/Redis is unavailable.
  // Also runs alongside SSE when Redis is healthy (deduplication prevents duplicates).
  useEffect(() => {
    if (!onFetchMessages) return;

    const interval = setInterval(async () => {
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
