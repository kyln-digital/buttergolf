/**
 * Prove a requester owns a Stripe PaymentIntent before fallback order
 * creation or disclosing `{ status: "processing" }`.
 *
 * Matches buyer/seller IDs in PaymentIntent metadata. Fail closed.
 */

export type PaymentIntentOwnershipFields = {
  metadata?: {
    buyerId?: string | null;
    sellerId?: string | null;
  } | null;
};

export type PaymentIntentRequester = {
  id: string;
};

export function requesterOwnsPaymentIntent(
  paymentIntent: PaymentIntentOwnershipFields,
  requester: PaymentIntentRequester
): boolean {
  const metadata = paymentIntent.metadata ?? undefined;
  if (metadata?.buyerId && metadata.buyerId === requester.id) {
    return true;
  }
  if (metadata?.sellerId && metadata.sellerId === requester.id) {
    return true;
  }
  return false;
}
