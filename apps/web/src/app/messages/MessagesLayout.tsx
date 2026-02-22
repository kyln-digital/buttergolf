"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useMedia } from "tamagui";
import { Column, Row } from "@buttergolf/ui";
import { View } from "tamagui";
import { ThreadList } from "./_components/ThreadList";

export interface Conversation {
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

  // Refresh thread list every 30 seconds so unread counts / previews stay current
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?limit=50");
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

  // Determine if a thread is currently selected (URL is /messages/[orderId])
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
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          style={containerStyle}
        >
          {children}
        </Column>
      );
    }

    return (
      <Column
        width="100%"
        height="100%"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        style={containerStyle}
      >
        <ThreadList conversations={conversations} activeOrderId={null} />
      </Column>
    );
  }

  // Desktop: split-pane layout
  return (
    <Row
      width="100%"
      height="100%"
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
        borderRightWidth={1}
        borderRightColor="$border"
        backgroundColor="$surface"
      >
        <ThreadList conversations={conversations} activeOrderId={extractOrderId(pathname)} />
      </Column>

      {/* Right pane — Conversation or empty state */}
      <Column flex={1} height="100%" backgroundColor="$background">
        {children}
      </Column>
    </Row>
  );
}

function extractOrderId(pathname: string): string | null {
  // pathname is /messages/[orderId] — extract the orderId
  const parts = pathname.split("/");
  if (parts.length >= 3 && parts[1] === "messages" && parts[2]) {
    return parts[2];
  }
  return null;
}
