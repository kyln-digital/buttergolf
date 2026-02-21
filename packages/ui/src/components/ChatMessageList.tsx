/**
 * ChatMessageList Component
 *
 * A scrollable message container with auto-scroll-to-bottom, date separators,
 * loading/empty states, and animated bubble rendering.
 *
 * @example
 * ```tsx
 * <ChatMessageList
 *   messages={messages}
 *   currentUserId={userId}
 *   otherUserName="Josh"
 *   otherUserImage="https://example.com/avatar.jpg"
 *   loading={isLoading}
 * />
 * ```
 */

"use client";

import { useEffect, useRef, useMemo } from "react";
import type React from "react";
import { View } from "tamagui";
import { Text } from "./Text";
import { Column, Row } from "./Layout";
import { Spinner } from "./Spinner";
import { ScrollView } from "./ScrollView";
import { ChatBubble } from "./ChatBubble";
import { MessageSquare } from "@tamagui/lucide-icons";

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead?: boolean;
}

interface ChatMessageListProps {
  /** Array of messages to display */
  messages: ChatMessage[];
  /** Current user's ID to determine message ownership */
  currentUserId: string;
  /** Other participant's display name */
  otherUserName: string;
  /** Other participant's avatar URL */
  otherUserImage?: string | null;
  /** Whether messages are loading */
  loading?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Format a timestamp string for display */
  formatTimestamp?: (dateString: string) => string;
}

function defaultFormatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <Row alignItems="center" gap="$md" paddingVertical="$sm">
      <View flex={1} height={1} backgroundColor="$border" />
      <Text size="$2" color="$textTertiary">
        {label}
      </Text>
      <View flex={1} height={1} backgroundColor="$border" />
    </Row>
  );
}

/** Group messages by date for separator rendering */
function groupByDate(messages: ChatMessage[]): Array<{ date: string; messages: ChatMessage[] }> {
  const groups: Array<{ date: string; messages: ChatMessage[] }> = [];

  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
  }

  return groups;
}

export function ChatMessageList({
  messages,
  currentUserId,
  otherUserName,
  otherUserImage,
  loading = false,
  emptyMessage,
  formatTimestamp = defaultFormatTimestamp,
}: Readonly<ChatMessageListProps>) {
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const hasScrolledOnce = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const behavior = hasScrolledOnce.current ? "smooth" : "auto";
      // Small delay to allow layout to settle
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: behavior === "smooth" });
      }, 100);
      hasScrolledOnce.current = true;
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const dateGroups = useMemo(() => groupByDate(messages), [messages]);

  if (loading) {
    return (
      <Column flex={1} alignItems="center" justifyContent="center" gap="$md">
        <Spinner size="lg" color="$primary" />
        <Text size="$4" color="$textSecondary">
          Loading messages...
        </Text>
      </Column>
    );
  }

  if (messages.length === 0) {
    return (
      <Column flex={1} alignItems="center" justifyContent="center" gap="$md" padding="$xl">
        <Column
          backgroundColor="$backgroundHover"
          borderRadius="$full"
          width={64}
          height={64}
          alignItems="center"
          justifyContent="center"
        >
          <MessageSquare size={28} color="$textSecondary" />
        </Column>
        <Text size="$5" color="$textSecondary" textAlign="center">
          {emptyMessage || `Start a conversation with ${otherUserName}`}
        </Text>
      </Column>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      flex={1}
      showsVerticalScrollIndicator={false}
      paddingHorizontal="$md"
      paddingVertical="$md"
    >
      <Column gap="$sm" paddingBottom="$md">
        {dateGroups.map((group) => (
          <Column key={group.date} gap="$sm">
            <DateSeparator label={formatDateSeparator(group.messages[0]?.createdAt ?? "")} />
            {group.messages.map((message) => (
              <ChatBubble
                key={message.id}
                isOwnMessage={message.senderId === currentUserId}
                content={message.content}
                timestamp={formatTimestamp(message.createdAt)}
                avatarUrl={message.senderId !== currentUserId ? otherUserImage : undefined}
                avatarName={message.senderId !== currentUserId ? otherUserName : undefined}
                animated={!message.id.startsWith("temp-")}
              />
            ))}
          </Column>
        ))}
      </Column>
    </ScrollView>
  );
}

export type { ChatMessageListProps, ChatMessage };
