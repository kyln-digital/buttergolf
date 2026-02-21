"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  Column,
  Row,
  Text,
  Spinner,
  Image,
  Heading,
  Badge,
  ChatBubble,
} from "@buttergolf/ui";
import { MessageSquare, ArrowRight } from "@tamagui/lucide-icons";
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
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchMessages();

    // Poll every 30s to keep the preview fresh
    const interval = setInterval(fetchMessages, 30_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Show only the last 3 messages as a preview
  const previewMessages = messages.slice(-3);
  const unreadCount = messages.filter((m) => !m.isRead && m.senderId !== currentUserId).length;

  return (
    <Card variant="elevated" padding="$lg">
      <Card.Header noBorder>
        <Row justifyContent="space-between" alignItems="center">
          <Row gap="$sm" alignItems="center">
            <MessageSquare size={20} color="$text" />
            <Heading level={3}>Messages</Heading>
            {unreadCount > 0 && (
              <Badge variant="primary" size="sm">
                {unreadCount} new
              </Badge>
            )}
          </Row>
        </Row>
      </Card.Header>

      <Card.Body>
        <Column
          backgroundColor="$background"
          borderRadius="$md"
          padding="$md"
          gap="$sm"
          minHeight={100}
        >
          {loading ? (
            <Column alignItems="center" justifyContent="center" height={100}>
              <Spinner size="lg" />
            </Column>
          ) : previewMessages.length === 0 ? (
            <Column alignItems="center" justifyContent="center" height={100} gap="$sm">
              <Text size="$4" color="$textSecondary" textAlign="center">
                No messages yet.
              </Text>
            </Column>
          ) : (
            previewMessages.map((message) => (
              <ChatBubble
                key={message.id}
                isOwnMessage={message.senderId === currentUserId}
                content={
                  message.content.length > 120
                    ? `${message.content.slice(0, 120)}...`
                    : message.content
                }
                timestamp={formatDateTime(message.createdAt)}
                avatarUrl={message.senderId !== currentUserId ? otherUserImage : undefined}
                avatarName={message.senderId !== currentUserId ? otherUserName : undefined}
                animated={false}
              />
            ))
          )}
        </Column>
      </Card.Body>

      <Card.Footer noBorder>
        <Link href={`/messages/${orderId}`} style={{ textDecoration: "none", width: "100%" }}>
          <Row
            alignItems="center"
            justifyContent="center"
            gap="$sm"
            paddingVertical="$sm"
            hoverStyle={{ opacity: 0.7 }}
            cursor="pointer"
          >
            <Text color="$primary" weight="semibold" size="$5">
              {messages.length > 0 ? "View full conversation" : "Start a conversation"}
            </Text>
            <ArrowRight size={18} color="$primary" />
          </Row>
        </Link>
      </Card.Footer>
    </Card>
  );
}
