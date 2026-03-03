"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMedia } from "tamagui";
import type { ChatMessage } from "@buttergolf/ui";
import { MessageThreadScreen } from "@buttergolf/app/src/features/messages/message-thread-screen";
import { createSupabaseEventSource } from "@/lib/supabase-realtime";

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  userRole: "buyer" | "seller";
  otherUserName: string;
  otherUserImage: string | null;
  productTitle: string;
  productImage: string | null;
  productPrice: number;
  productSold: boolean;
  hasActiveOffer: boolean;
  initialMessages: ChatMessage[];
}

export function MessageThread({
  conversationId,
  currentUserId,
  userRole,
  otherUserName,
  otherUserImage,
  productTitle,
  productImage,
  productPrice,
  productSold,
  hasActiveOffer: initialHasActiveOffer,
  initialMessages,
}: Readonly<MessageThreadProps>) {
  const router = useRouter();
  const media = useMedia();
  const isMobile = !media.gtMd;

  // productPrice reserved for future use (e.g. showing offer percentage)
  void productPrice;

  const [hasActiveOffer, setHasActiveOffer] = useState(initialHasActiveOffer);

  const handleSendMessage = useCallback(
    async (_id: string, content: string) => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
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
    },
    [conversationId]
  );

  const handleMarkAsRead = useCallback(async () => {
    await fetch(`/api/conversations/${conversationId}/messages/mark-read`, {
      method: "POST",
    });
  }, [conversationId]);

  const handleFetchMessages = useCallback(
    async (_id: string, cursor?: string) => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/conversations/${conversationId}/messages${qs}`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    [conversationId]
  );

  const handleMakeOffer = useCallback(
    async (amount: number, message?: string) => {
      const response = await fetch(`/api/conversations/${conversationId}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, message }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to make offer");
      }

      setHasActiveOffer(true);
      return response.json();
    },
    [conversationId]
  );

  const handleCounterOffer = useCallback(
    async (amount: number, message?: string) => {
      const response = await fetch(`/api/conversations/${conversationId}/offer/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, message }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to counter offer");
      }

      return response.json();
    },
    [conversationId]
  );

  const handleAcceptOffer = useCallback(async () => {
    const response = await fetch(`/api/conversations/${conversationId}/offer/accept`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to accept offer");
    }

    const data = await response.json();
    setHasActiveOffer(false);

    // Redirect buyer to checkout immediately after accepting
    if (userRole === "buyer" && data.checkoutUrl) {
      router.push(data.checkoutUrl);
    }

    return data;
  }, [conversationId, userRole, router]);

  const handleRejectOffer = useCallback(async () => {
    const response = await fetch(`/api/conversations/${conversationId}/offer/reject`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to reject offer");
    }

    setHasActiveOffer(false);
    return response.json();
  }, [conversationId]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flex: 1, minHeight: 0 }}>
      <MessageThreadScreen
        orderId={conversationId}
        currentUserId={currentUserId}
        userRole={userRole}
        otherUserName={otherUserName}
        otherUserImage={otherUserImage}
        productTitle={productTitle}
        productImage={productImage}
        initialMessages={initialMessages}
        onFetchMessages={handleFetchMessages}
        onSendMessage={handleSendMessage}
        onMarkAsRead={handleMarkAsRead}
        onBack={isMobile ? () => router.push("/messages") : undefined}
        createEventSource={createSupabaseEventSource}
        showOfferButton={userRole === "buyer" && !productSold && !hasActiveOffer}
        onMakeOffer={handleMakeOffer}
        onCounterOffer={handleCounterOffer}
        onAcceptOffer={handleAcceptOffer}
        onRejectOffer={handleRejectOffer}
      />
    </div>
  );
}
