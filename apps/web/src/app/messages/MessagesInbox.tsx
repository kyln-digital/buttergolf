"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Column, Row, Text, Heading, Badge, Container, ConversationListItem } from "@buttergolf/ui";
import { MessageSquare } from "@tamagui/lucide-icons";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  orderId: string;
  productTitle: string;
  productImage: string | null;
  otherUserName: string;
  otherUserImage: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  userRole: "buyer" | "seller";
  orderStatus: string;
}

interface MessagesInboxProps {
  conversations: Conversation[];
}

export function MessagesInbox({ conversations }: MessagesInboxProps) {
  const router = useRouter();

  if (conversations.length === 0) {
    return (
      <Container size="lg" paddingVertical="$3xl">
        <Column gap="$lg" alignItems="center" justifyContent="center" paddingVertical="$3xl">
          <Column
            backgroundColor="$backgroundHover"
            borderRadius="$full"
            width={80}
            height={80}
            alignItems="center"
            justifyContent="center"
          >
            <MessageSquare size={32} color="$textSecondary" />
          </Column>
          <Heading level={2}>No Messages Yet</Heading>
          <Text color="$textSecondary" textAlign="center" maxWidth={400}>
            When you buy or sell items, your conversations with buyers and sellers will appear here.
          </Text>
          <Link href="/listings" style={{ textDecoration: "none" }}>
            <Text
              color="$primary"
              weight="semibold"
              hoverStyle={{ textDecorationLine: "underline" }}
            >
              Start shopping →
            </Text>
          </Link>
        </Column>
      </Container>
    );
  }

  return (
    <Container size="lg" paddingVertical="$xl">
      <Column gap="$lg">
        <Row justifyContent="space-between" alignItems="center">
          <Heading level={1}>Messages</Heading>
          <Badge variant="primary" size="lg">
            {conversations.reduce((acc, c) => acc + c.unreadCount, 0)} unread
          </Badge>
        </Row>

        <Column gap="$md">
          {conversations.map((conversation, index) => (
            <ConversationListItem
              key={conversation.orderId}
              productImage={conversation.productImage}
              productTitle={conversation.productTitle}
              otherUserName={conversation.otherUserName}
              lastMessage={conversation.lastMessagePreview}
              timestamp={formatDistanceToNow(new Date(conversation.lastMessageAt), {
                addSuffix: true,
              })}
              unreadCount={conversation.unreadCount}
              onPress={() => router.push(`/messages/${conversation.orderId}`)}
              index={index}
            />
          ))}
        </Column>
      </Column>
    </Container>
  );
}
