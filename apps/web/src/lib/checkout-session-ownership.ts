/**
 * Prove a requester owns a Stripe Checkout Session before disclosing
 * session state (e.g. `{ status: "processing" }` for paid-but-unmaterialised).
 *
 * Matches buyer/seller IDs in session metadata, `client_reference_id`, or
 * customer email. Fail closed: no match ⇒ treat as not owned.
 */

export type CheckoutSessionOwnershipFields = {
  client_reference_id?: string | null;
  customer_email?: string | null;
  metadata?: {
    buyerId?: string | null;
    sellerId?: string | null;
  } | null;
};

export type CheckoutSessionRequester = {
  id: string;
  email?: string | null;
};

export function requesterOwnsCheckoutSession(
  session: CheckoutSessionOwnershipFields,
  requester: CheckoutSessionRequester
): boolean {
  const metadata = session.metadata ?? undefined;
  if (metadata?.buyerId && metadata.buyerId === requester.id) {
    return true;
  }
  if (metadata?.sellerId && metadata.sellerId === requester.id) {
    return true;
  }
  if (session.client_reference_id && session.client_reference_id === requester.id) {
    return true;
  }
  if (
    requester.email &&
    session.customer_email &&
    requester.email.toLowerCase() === session.customer_email.toLowerCase()
  ) {
    return true;
  }
  return false;
}
