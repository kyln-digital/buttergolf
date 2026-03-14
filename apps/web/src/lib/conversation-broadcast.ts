type BroadcastMessageLike = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string | null;
  offerAmount?: number | null;
  offerId?: string | null;
  createdAt: string | Date;
  isRead: boolean;
};

interface BroadcastMessageOverrides {
  offerId?: string | null;
  offerStatus?: string | null;
}

interface OfferUpdatePayload {
  offerId: string;
  status: string;
  amount?: number;
  counterOfferId?: string;
}

export function toBroadcastMessage(
  message: BroadcastMessageLike,
  overrides: BroadcastMessageOverrides = {}
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    type: message.type,
    offerAmount: message.offerAmount ?? null,
    offerId: overrides.offerId ?? message.offerId ?? null,
    offerStatus: overrides.offerStatus ?? null,
    createdAt:
      message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    isRead: message.isRead,
  };
}

export function toNewMessageBroadcast(
  message: BroadcastMessageLike,
  overrides: BroadcastMessageOverrides = {}
) {
  return {
    type: "new_message" as const,
    message: toBroadcastMessage(message, overrides),
  };
}

export function toOfferUpdateBroadcast(payload: OfferUpdatePayload) {
  return {
    type: "offer_update" as const,
    ...payload,
  };
}
