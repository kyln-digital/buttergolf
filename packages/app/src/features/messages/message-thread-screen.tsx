"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Column,
  Row,
  ScrollView,
  Text,
  Spinner,
  Button,
  TextArea,
  Card,
  Image,
} from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send, Clock } from "@tamagui/lucide-icons";
import { formatDistanceToNow } from "date-fns";

const MESSAGE_LIMITS = {
  MAX_LENGTH: 2000,
  MIN_LENGTH: 1,
};

interface Message {
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
  /** Callback to fetch messages for this order */
  onFetchMessages?: (orderId: string) => Promise<{
    messages: Message[];
    userRole?: "buyer" | "seller";
  }>;
  /** Callback to send a message */
  onSendMessage?: (orderId: string, content: string) => Promise<Message>;
  /** Callback to mark messages as read */
  onMarkAsRead?: (orderId: string) => Promise<void>;
  /** Navigate back */
  onBack?: () => void;
}

export function MessageThreadScreen({
  orderId,
  currentUserId,
  userRole = "buyer",
  otherUserName,
  otherUserImage,
  productTitle = "Order",
  onFetchMessages,
  onSendMessage,
  onMarkAsRead,
  onBack,
}: Readonly<MessageThreadScreenProps>) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sseError, setSSEError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isOverLimit = newMessage.length > MESSAGE_LIMITS.MAX_LENGTH;

  // Fetch initial messages and setup SSE
  useEffect(() => {
    let cancelled = false;

    const fetchAndSetupSSE = async () => {
      try {
        // Fetch initial messages
        if (onFetchMessages) {
          const data = await onFetchMessages(orderId);
          if (!cancelled) {
            setMessages(
              data.messages.map((msg) => ({
                ...msg,
                isOwnMessage: msg.senderId === currentUserId,
              }))
            );
          }
        }

        // Mark messages as read
        if (onMarkAsRead && !cancelled) {
          await onMarkAsRead(orderId).catch((err) => {
            console.warn("Failed to mark messages as read:", err);
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load messages");
          console.error("Error fetching messages:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAndSetupSSE();

    // Setup SSE stream for real-time messages (web-only)
    if (typeof window !== "undefined" && window.EventSource) {
      const eventSource = new EventSource(`/api/orders/${orderId}/messages/stream`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("open", () => {
        console.log("[SSE] Connected to message stream");
        setIsConnected(true);
        setSSEError(null);
      });

      eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "new_message" && data.message) {
            if (!cancelled) {
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === data.message.id)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    ...data.message,
                    isOwnMessage: data.message.senderId === currentUserId,
                  },
                ];
              });
            }
          }
        } catch (err) {
          console.error("[SSE] Failed to parse message:", err);
        }
      });

      eventSource.addEventListener("error", () => {
        if (!cancelled) {
          setIsConnected(false);
          setSSEError("Connection lost. Reconnecting...");
          console.error("[SSE] Connection error");
        }
      });
    }

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [orderId, currentUserId, onFetchMessages, onMarkAsRead]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending || isOverLimit) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      if (onSendMessage) {
        // Optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
          id: tempId,
          orderId,
          senderId: currentUserId,
          senderName: "You",
          senderImage: null,
          content: newMessage.trim(),
          createdAt: new Date().toISOString(),
          isRead: false,
          isOwnMessage: true,
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        setNewMessage("");

        try {
          // Send to server
          const message = await onSendMessage(orderId, newMessage.trim());

          // Replace optimistic message with real message
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...message, isOwnMessage: true } : m))
          );
        } catch (err) {
          // Remove optimistic message on failure
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setError(err instanceof Error ? err.message : "Failed to send message");
          console.error("Error sending message:", err);
        }
      }
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, isOverLimit, orderId, currentUserId, onSendMessage]);

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
        <Column flex={1} gap="$xs">
          <Row alignItems="center" gap="$sm">
            <Text size="$6" weight="bold" numberOfLines={1} flex={1}>
              {productTitle}
            </Text>
            {/* Real-time connection indicator (web only) */}
            {typeof window !== "undefined" && window.EventSource && (
              <Row alignItems="center" gap="$xs">
                <Column
                  width={8}
                  height={8}
                  borderRadius="$full"
                  backgroundColor={isConnected ? "$success" : "$warning"}
                />
                <Text size="$2" color="$textTertiary">
                  {isConnected ? "Live" : "Offline"}
                </Text>
              </Row>
            )}
          </Row>
          <Text size="$4" color="$textSecondary" numberOfLines={1}>
            {otherUserName}
          </Text>
        </Column>
      </Row>

      {/* Connection Status */}
      {sseError && (
        <Row
          backgroundColor="$warning"
          opacity={0.1}
          paddingHorizontal="$md"
          paddingVertical="$sm"
          alignItems="center"
          gap="$md"
        >
          <Clock size={16} color="$warning" />
          <Text size="$3" color="$warning">
            {sseError}
          </Text>
        </Row>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        flex={1}
        showsVerticalScrollIndicator={false}
        paddingHorizontal="$md"
        paddingVertical="$md"
      >
        {error && (
          <Card backgroundColor="$error" opacity={0.1} marginBottom="$md">
            <Text color="$error" size="$4">
              {error}
            </Text>
          </Card>
        )}

        {loading ? (
          <Column alignItems="center" justifyContent="center" flex={1} gap="$md">
            <Spinner size="lg" color="$primary" />
            <Text color="$textSecondary">Loading messages...</Text>
          </Column>
        ) : messages.length === 0 ? (
          <Column alignItems="center" justifyContent="center" gap="$md" paddingVertical="$xl">
            <Text size="$5" color="$textSecondary" textAlign="center">
              Start a conversation with {otherUserName}
            </Text>
          </Column>
        ) : (
          <Column gap="$md" paddingBottom="$md">
            {messages.map((message) => (
              <Row
                key={message.id}
                alignItems="flex-end"
                gap="$md"
                flexDirection={message.isOwnMessage ? "row-reverse" : "row"}
              >
                {/* Avatar */}
                {!message.isOwnMessage && otherUserImage && (
                  <Image
                    source={{ uri: otherUserImage }}
                    width={32}
                    height={32}
                    borderRadius={16}
                    backgroundColor="$surface"
                  />
                )}
                {message.isOwnMessage && <Column width={32} />}

                {/* Message Bubble */}
                <Column
                  maxWidth="75%"
                  backgroundColor={message.isOwnMessage ? "$primary" : "$surface"}
                  borderRadius="$lg"
                  paddingHorizontal="$md"
                  paddingVertical="$sm"
                  borderWidth={1}
                  borderColor={message.isOwnMessage ? "$primary" : "$border"}
                >
                  <Text
                    size="$4"
                    color={message.isOwnMessage ? "$textInverse" : "$text"}
                    whiteSpace="pre-wrap"
                  >
                    {message.content}
                  </Text>
                  <Text
                    size="$2"
                    color={message.isOwnMessage ? "$primaryLight" : "$textTertiary"}
                    marginTop="$xs"
                  >
                    {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                  </Text>
                </Column>
              </Row>
            ))}
          </Column>
        )}
      </ScrollView>

      {/* Input Area */}
      <Column
        gap="$md"
        paddingHorizontal="$md"
        paddingVertical="$md"
        borderTopWidth={1}
        borderTopColor="$border"
        backgroundColor="$background"
        paddingBottom={Math.max(insets.bottom, 8)}
      >
        <Row alignItems="flex-end" gap="$md">
          <Column flex={1} gap="$xs">
            <TextArea
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              size="md"
              rows={2}
              maxLength={MESSAGE_LIMITS.MAX_LENGTH + 100}
              editable={!sending}
              disabled={sending}
            />
            <Row justifyContent="space-between" alignItems="center">
              <Text size="$2" color={isOverLimit ? "$error" : "$textTertiary"}>
                {newMessage.length}/{MESSAGE_LIMITS.MAX_LENGTH}
              </Text>
              {isOverLimit && (
                <Text size="$2" color="$error">
                  Over limit
                </Text>
              )}
            </Row>
          </Column>

          <Button
            size="$5"
            backgroundColor="$primary"
            color="$textInverse"
            borderRadius="$full"
            onPress={handleSend}
            disabled={sending || !newMessage.trim() || isOverLimit}
            paddingHorizontal="$md"
          >
            {sending ? <Spinner size="sm" color="$textInverse" /> : <Send size={20} />}
          </Button>
        </Row>
      </Column>
    </Column>
  );
}
