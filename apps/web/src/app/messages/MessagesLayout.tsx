"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useMedia } from "tamagui";
import { Column, Row, View } from "@buttergolf/ui";
import { ThreadList } from "./_components/ThreadList";

export interface Conversation {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  productPrice: number;
  productSold: boolean;
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  otherUserAverageRating: number | null;
  otherUserRatingCount: number;
  lastMessagePreview: string | null;
  lastMessageType: string | null;
  lastMessageAt: string;
  unreadCount: number;
  userRole: "buyer" | "seller";
  orderId: string | null;
  latestOfferStatus: string | null;
  latestOfferAmount: number | null;
}

interface MessagesLayoutProps {
  conversations: Conversation[];
  children: React.ReactNode;
}

export function MessagesLayout({
  conversations: initialConversations,
  children,
}: MessagesLayoutProps) {
  const pathname = usePathname();
  const media = useMedia();
  const isDesktop = media.gtMd;

  const [conversations, setConversations] = useState(initialConversations);

  // Optimistic active conversation ID — updated immediately on click,
  // before the server-side navigation completes.
  const urlConversationId = extractConversationId(pathname);
  const [optimisticId, setOptimisticId] = useState<string | null>(urlConversationId);

  // Sync optimistic state once the URL catches up (navigation finishes)
  useEffect(() => {
    setOptimisticId(urlConversationId);
  }, [urlConversationId]);

  // Keep local conversations state in sync when the parent prop changes
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Refresh thread list every 30 seconds so unread counts / previews stay current
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      // Silent — don't surface polling errors
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshConversations, 30000);
    return () => clearInterval(interval);
  }, [refreshConversations]);

  // Determine if a thread is currently selected (URL is /messages/[conversationId])
  const isThreadSelected = pathname !== "/messages" && pathname.startsWith("/messages/");

  const containerStyle = {
    overflow: "hidden" as const,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  };

  // On mobile, show either the thread list or the conversation, not both
  if (!isDesktop) {
    if (isThreadSelected) {
      return (
        <Column
          width="100%"
          height="100%"
          minHeight={0}
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          style={containerStyle}
        >
          <View flex={1} minHeight={0}>
            {children}
          </View>
        </Column>
      );
    }

    return (
      <Column
        width="100%"
        height="100%"
        minHeight={0}
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        style={containerStyle}
      >
        <ThreadList conversations={conversations} activeConversationId={null} />
      </Column>
    );
  }

  // Desktop: split-pane layout
  return (
    <Row
      width="100%"
      height="100%"
      minHeight={0}
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      style={containerStyle}
    >
      {/* Left pane — Thread list */}
      <Column
        width={360}
        minWidth={360}
        height="100%"
        minHeight={0}
        borderRightWidth={1}
        borderRightColor="$border"
        backgroundColor="$surface"
      >
        <ThreadList
          conversations={conversations}
          activeConversationId={optimisticId}
          onSelectConversation={setOptimisticId}
        />
      </Column>

      {/* Right pane — Conversation or empty state */}
      <Column flex={1} height="100%" minHeight={0} backgroundColor="$background">
        <View flex={1} minHeight={0}>
          {children}
        </View>
      </Column>
    </Row>
  );
}

function extractConversationId(pathname: string): string | null {
  const parts = pathname.split("/");
  if (parts.length >= 3 && parts[1] === "messages" && parts[2]) {
    return parts[2];
  }
  return null;
}
