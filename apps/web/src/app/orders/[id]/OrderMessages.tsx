"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  Column,
  Row,
  Text,
  TextArea,
  Button,
  Spinner,
  Image,
  Heading,
  Badge,
} from "@buttergolf/ui";
import { POLLING_INTERVALS, MESSAGE_LIMITS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils/format";

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  isRead: boolean;
}

interface OrderMessagesProps {
  orderId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
}

export function OrderMessages({
  orderId,
  currentUserId,
  otherUserName,
  otherUserImage,
}: OrderMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [hasScrolledOnce, setHasScrolledOnce] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Mark messages as read when they become visible
  const markMessagesAsRead = useCallback(async () => {
    try {
      await fetch(`/api/orders/${orderId}/messages/mark-read`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  }, [orderId]);

  // Setup Intersection Observer for marking messages as read
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Message is visible, mark as read after a short delay
            setTimeout(() => {
              markMessagesAsRead();
            }, 500);
          }
        });
      },
      { threshold: 0.5 }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [markMessagesAsRead]);

  // Observe message list for visibility
  useEffect(() => {
    if (messageListRef.current && observerRef.current) {
      observerRef.current.observe(messageListRef.current);
    }
  }, [messages]);

  // Fetch messages on mount
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Setup SSE stream separately to avoid connection leak when fetchMessages changes
  useEffect(() => {
    // Setup SSE connection for real-time messages
    const eventSource = new EventSource(`/api/orders/${orderId}/messages/stream`);

    eventSource.addEventListener("open", () => {
      console.log("[SSE] Connected to message stream");
      setError(null);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle new message events
        if (data.type === "new_message" && data.message) {
          setMessages((prev) => {
            // Check if message already exists (avoid duplicates)
            if (prev.some((m) => m.id === data.message.id)) {
              return prev;
            }
            return [
              ...prev,
              {
                id: data.message.id,
                orderId: data.message.orderId,
                senderId: data.message.senderId,
                content: data.message.content,
                createdAt: data.message.createdAt,
                isRead: data.message.isRead,
              },
            ];
          });
        }
      } catch (err) {
        console.error("[SSE] Failed to parse message:", err);
      }
    });

    eventSource.addEventListener("error", (err) => {
      console.error("[SSE] Connection error:", err);
      setError("Connection lost. Attempting to reconnect...");
      // EventSource will automatically try to reconnect
    });

    return () => {
      console.log("[SSE] Disconnecting from message stream");
      eventSource.close();
    };
  }, [orderId]); // Only orderId - not fetchMessages

  // Auto-scroll: instant on first load, smooth on updates
  useEffect(() => {
    if (messages.length > 0) {
      const behavior = hasScrolledOnce ? "smooth" : "auto";
      messagesEndRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior });
      if (!hasScrolledOnce) {
        setHasScrolledOnce(true);
      }
    }
  }, [messages, hasScrolledOnce]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending || newMessage.length > MESSAGE_LIMITS.MAX_LENGTH) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setNewMessage("");
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = newMessage.length > MESSAGE_LIMITS.MAX_LENGTH;

  return (
    <Card variant="elevated" padding="$lg">
      <Card.Header noBorder>
        <Heading level={2} size="$7">
          Messages
        </Heading>
      </Card.Header>

      <Card.Body>
        <Column
          ref={messageListRef}
          height={320}
          style={{ overflow: "auto" }}
          backgroundColor="$background"
          borderRadius="$md"
          padding="$md"
          gap="$md"
        >
          {loading ? (
            <Column alignItems="center" justifyContent="center" height="100%">
              <Spinner size="lg" />
              <Text size="$4" color="$textSecondary" marginTop="$sm">
                Loading messages...
              </Text>
            </Column>
          ) : messages.length === 0 ? (
            <Column alignItems="center" justifyContent="center" height="100%">
              <Text size="$4" color="$textSecondary" textAlign="center">
                No messages yet. Start a conversation with {otherUserName || "the other party"}.
              </Text>
            </Column>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.senderId === currentUserId;
              return (
                <Row
                  key={message.id}
                  gap="$md"
                  alignItems="flex-start"
                  flexDirection={isOwnMessage ? "row-reverse" : "row"}
                >
                  {!isOwnMessage && otherUserImage && (
                    <Image
                      source={{ uri: otherUserImage }}
                      width={32}
                      height={32}
                      borderRadius={16}
                      alt={`${otherUserName}'s avatar`}
                    />
                  )}
                  <Column
                    flex={1}
                    maxWidth="70%"
                    backgroundColor={isOwnMessage ? "$primary" : "$surface"}
                    borderRadius="$lg"
                    padding="$md"
                    borderWidth={1}
                    borderColor={isOwnMessage ? "$primary" : "$border"}
                  >
                    <Text
                      size="$4"
                      color={isOwnMessage ? "$textInverse" : "$text"}
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {message.content}
                    </Text>
                    <Text
                      size="$2"
                      color={isOwnMessage ? "$primaryLight" : "$textSecondary"}
                      marginTop="$xs"
                    >
                      {formatDateTime(message.createdAt)}
                    </Text>
                  </Column>
                </Row>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </Column>
      </Card.Body>

      <Card.Footer noBorder>
        <Column gap="$sm" fullWidth>
          {error && (
            <Row alignItems="center" gap="$sm">
              <Badge variant="error">Error</Badge>
              <Text size="$3" color="$error">
                {error}
              </Text>
            </Row>
          )}

          <Row gap="$md" alignItems="flex-end" width="100%">
            <Column flex={1} gap="$xs">
              <TextArea
                value={newMessage}
                onChangeText={setNewMessage}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                size="md"
                rows={2}
                maxLength={MESSAGE_LIMITS.MAX_LENGTH + 100} // Allow typing over but show error
                error={isOverLimit}
                disabled={sending}
              />
              <Row justifyContent="space-between" alignItems="center">
                <Text size="$2" color={isOverLimit ? "$error" : "$textTertiary"}>
                  {newMessage.length}/{MESSAGE_LIMITS.MAX_LENGTH}
                </Text>
                {isOverLimit && (
                  <Badge variant="error" size="sm">
                    Over limit
                  </Badge>
                )}
              </Row>
            </Column>

            <Button
              butterVariant="primary"
              size="$5"
              onPress={handleSend}
              disabled={sending || !newMessage.trim() || isOverLimit}
            >
              {sending ? "Sending..." : "Send"}
            </Button>
          </Row>
        </Column>
      </Card.Footer>
    </Card>
  );
}
