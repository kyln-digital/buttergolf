"use client";

import Link from "next/link";
import { Column, Row, Text, Heading, Card, Badge, Image, Container } from "@buttergolf/ui";
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
            <Text size="$9">💬</Text>
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
          {conversations.map((conversation) => (
            <Link
              key={conversation.orderId}
              href={`/orders/${conversation.orderId}`}
              style={{ textDecoration: "none" }}
            >
              <Card
                variant="outlined"
                padding="$md"
                hoverStyle={{
                  borderColor: "$primary",
                  backgroundColor: "$backgroundHover",
                }}
                cursor="pointer"
              >
                <Row gap="$md" alignItems="center">
                  {/* Product Image */}
                  {conversation.productImage ? (
                    <Image
                      source={{ uri: conversation.productImage }}
                      width={60}
                      height={60}
                      borderRadius="$md"
                      alt={conversation.productTitle}
                    />
                  ) : (
                    <Column
                      width={60}
                      height={60}
                      borderRadius="$md"
                      backgroundColor="$backgroundHover"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text size="$7">📦</Text>
                    </Column>
                  )}

                  {/* Conversation Details */}
                  <Column flex={1} gap="$xs">
                    <Row justifyContent="space-between" alignItems="center">
                      <Text weight="semibold" numberOfLines={1}>
                        {conversation.otherUserName}
                      </Text>
                      <Text size="$2" color="$textSecondary">
                        {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                          addSuffix: true,
                        })}
                      </Text>
                    </Row>

                    <Text size="$3" color="$textSecondary" numberOfLines={1}>
                      {conversation.productTitle}
                    </Text>

                    {conversation.lastMessagePreview && (
                      <Text
                        size="$4"
                        color={conversation.unreadCount > 0 ? "$text" : "$textSecondary"}
                        weight={conversation.unreadCount > 0 ? "semibold" : "normal"}
                        numberOfLines={1}
                      >
                        {conversation.lastMessagePreview}
                      </Text>
                    )}
                  </Column>

                  {/* Unread Badge */}
                  {conversation.unreadCount > 0 && (
                    <Column
                      backgroundColor="$primary"
                      borderRadius="$full"
                      minWidth={24}
                      height={24}
                      alignItems="center"
                      justifyContent="center"
                      paddingHorizontal="$xs"
                    >
                      <Text size="$2" color="$textInverse" weight="bold">
                        {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                      </Text>
                    </Column>
                  )}
                </Row>
              </Card>
            </Link>
          ))}
        </Column>
      </Column>
    </Container>
  );
}
