"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Column,
  Row,
  Text,
  Spinner,
  Button,
  View,
  Image,
  ChatMessageList,
  ChatInput,
} from "@buttergolf/ui";
import type { ChatMessage } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "@tamagui/lucide-icons";

const MESSAGE_LIMITS = {
  MAX_LENGTH: 2000,
  MIN_LENGTH: 1,
};

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
  const [isConnected, setIsConnected] = useState(false);
  const [sseError, setSSEError] = useState<string | null>(null);

  const isOverLimit = newMessage.length > MESSAGE_LIMITS.MAX_LENGTH;

  // Fetch initial messages and setup SSE
  useEffect(() => {
    let cancelled = false;

    const fetchAndSetup = async () => {
      try {
        if (onFetchMessages && !initialMessages) {
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

    // Setup SSE stream for real-time messages (web-only)
    let eventSource: EventSource | null = null;
    if (typeof window !== "undefined" && window.EventSource) {
      eventSource = new EventSource(`/api/orders/${orderId}/messages/stream`);

      eventSource.addEventListener("open", () => {
        if (!cancelled) {
          setIsConnected(true);
          setSSEError(null);
        }
      });

      eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && data.message && !cancelled) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [
                ...prev,
                {
                  id: data.message.id,
                  senderId: data.message.senderId,
                  content: data.message.content,
                  createdAt: data.message.createdAt,
                  isRead: data.message.isRead,
                },
              ];
            });
          }
        } catch {
          // Ignore heartbeat parse errors
        }
      });

      eventSource.addEventListener("error", () => {
        if (!cancelled) {
          setIsConnected(false);
          setSSEError("Connection lost. Reconnecting...");
        }
      });
    }

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [orderId, currentUserId, initialMessages, onFetchMessages, onMarkAsRead]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending || isOverLimit) return;

    setSending(true);
    setError(null);

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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  id: message.id,
                  senderId: message.senderId,
                  content: message.content,
                  createdAt: message.createdAt,
                  isRead: message.isRead,
                }
              : m
          )
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to send message");
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
          <Row alignItems="center" gap="$sm">
            <Text size="$6" weight="bold" numberOfLines={1} flex={1}>
              {productTitle}
            </Text>
            {typeof window !== "undefined" && window.EventSource && (
              <Row alignItems="center" gap="$xs">
                <View
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

      {/* SSE Error Banner */}
      {sseError && (
        <Row
          backgroundColor="$warningLight"
          paddingHorizontal="$md"
          paddingVertical="$sm"
          alignItems="center"
          gap="$sm"
        >
          <Text size="$3" color="$warning">
            {sseError}
          </Text>
        </Row>
      )}

      {/* Error Banner */}
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
          <Text
            size="$3"
            color="$error"
            weight="semibold"
            cursor="pointer"
            onPress={() => setError(null)}
          >
            Dismiss
          </Text>
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
