"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMedia } from "tamagui";
import { Column } from "@buttergolf/ui";
import type { ChatMessage } from "@buttergolf/ui";
import { MessageThreadScreen } from "@buttergolf/app/src/features/messages/message-thread-screen";

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
  const router = useRouter();
  const media = useMedia();
  const isMobile = !media.gtMd;

  const handleSendMessage = useCallback(async (oid: string, content: string) => {
    const response = await fetch(`/api/orders/${oid}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to send message");
    }

    const data = await response.json();
    return data.message;
  }, []);

  const handleMarkAsRead = useCallback(async (oid: string) => {
    await fetch(`/api/orders/${oid}/messages/mark-read`, {
      method: "POST",
    });
  }, []);

  return (
    <Column width="100%" height="100%">
      <MessageThreadScreen
        orderId={orderId}
        currentUserId={currentUserId}
        otherUserName={otherUserName}
        otherUserImage={otherUserImage}
        productTitle={productTitle}
        productImage={productImage}
        initialMessages={initialMessages}
        onSendMessage={handleSendMessage}
        onMarkAsRead={handleMarkAsRead}
        onBack={isMobile ? () => router.push("/messages") : undefined}
      />
    </Column>
  );
}
