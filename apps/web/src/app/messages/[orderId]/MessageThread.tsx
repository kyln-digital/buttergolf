"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Column,
  Row,
  Text,
  Heading,
  Image,
  View,
  ChatMessageList,
  ChatInput,
} from "@buttergolf/ui";
import type { ChatMessage } from "@buttergolf/ui";
import { ArrowLeft } from "@tamagui/lucide-icons";
import { MESSAGE_LIMITS } from "@/lib/constants";

interface MessageThreadProps {
  orderId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  productTitle: string;
  productImage: string | null;
  initialMessages: ChatMessage[];
}

export function MessageThread({
  orderId,
  currentUserId,
  otherUserName,
  otherUserImage,
  productTitle,
  productImage,
  initialMessages,
}: Readonly<MessageThreadProps>) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // SSE real-time connection
  useEffect(() => {
    const eventSource = new EventSource(`/api/orders/${orderId}/messages/stream`);

    eventSource.addEventListener("open", () => {
      setIsConnected(true);
      setError(null);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message" && data.message) {
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
        // Ignore parse errors from heartbeat messages
      }
    });

    eventSource.addEventListener("error", () => {
      setIsConnected(false);
    });

    return () => {
      eventSource.close();
    };
  }, [orderId]);

  // Mark messages as read on mount and when new messages arrive
  useEffect(() => {
    const unread = messages.some((m) => m.senderId !== currentUserId && !m.isRead);
    if (unread) {
      fetch(`/api/orders/${orderId}/messages/mark-read`, {
        method: "POST",
      }).catch(() => {});
    }
  }, [messages, orderId, currentUserId]);

  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || sending || content.length > MESSAGE_LIMITS.MAX_LENGTH) return;

    setSending(true);
    setError(null);

    // Optimistic update
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
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      const data = await response.json();

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                id: data.message.id,
                senderId: data.message.senderId,
                content: data.message.content,
                createdAt: data.message.createdAt,
                isRead: data.message.isRead,
              }
            : m
        )
      );
    } catch (err) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, orderId, currentUserId]);

  return (
    <Column width="100%" height="calc(100dvh - 120px)" backgroundColor="$background">
      {/* Header */}
      <Row
        alignItems="center"
        gap="$md"
        paddingHorizontal="$md"
        paddingVertical="$sm"
        borderBottomWidth={1}
        borderBottomColor="$border"
        backgroundColor="$surface"
        animation="medium"
        enterStyle={{ opacity: 0, y: -10 }}
        opacity={1}
        y={0}
      >
        <Link href="/messages" style={{ textDecoration: "none" }}>
          <Row
            alignItems="center"
            gap="$xs"
            hoverStyle={{ opacity: 0.7 }}
            cursor="pointer"
            paddingVertical="$sm"
            paddingRight="$sm"
          >
            <ArrowLeft size={20} color="var(--color-primary)" />
          </Row>
        </Link>

        {productImage && (
          <Image
            source={{ uri: productImage }}
            width={40}
            height={40}
            borderRadius="$md"
            alt={productTitle}
          />
        )}

        <Column flex={1} gap={2}>
          <Text size="$5" weight="semibold" numberOfLines={1}>
            {productTitle}
          </Text>
          <Text size="$3" color="$textSecondary" numberOfLines={1}>
            {otherUserName}
          </Text>
        </Column>

        {/* Connection status indicator */}
        <Row alignItems="center" gap="$xs">
          <View
            width={8}
            height={8}
            borderRadius="$full"
            backgroundColor={isConnected ? "$success" : "$warning"}
            animation="slow"
            opacity={isConnected ? 1 : 0.6}
          />
          <Text size="$2" color="$textTertiary">
            {isConnected ? "Live" : "Offline"}
          </Text>
        </Row>
      </Row>

      {/* Error banner */}
      {error && (
        <Row
          backgroundColor="$errorLight"
          paddingHorizontal="$md"
          paddingVertical="$sm"
          gap="$sm"
          alignItems="center"
          animation="fast"
          enterStyle={{ opacity: 0, y: -10 }}
          opacity={1}
          y={0}
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
      />

      {/* Input */}
      <ChatInput
        value={newMessage}
        onChangeText={setNewMessage}
        onSend={handleSend}
        sending={sending}
        maxLength={MESSAGE_LIMITS.MAX_LENGTH}
      />
    </Column>
  );
}
