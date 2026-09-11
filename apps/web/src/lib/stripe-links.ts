/**
 * Deep links into the Stripe dashboard for staff. Test-mode keys get the
 * /test/ prefix so a preview environment opens the right ledger.
 */
function dashboardBase(): string {
  const testMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
  return testMode ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com";
}

export interface StripeLinks {
  paymentIntent: string | null;
  charge: string | null;
  transfer: string | null;
  account: string | null;
}

export function stripeLinksForOrder(order: {
  stripePaymentId: string | null;
  stripeChargeId: string | null;
  stripeTransferId: string | null;
  seller: { stripeConnectId: string | null };
}): StripeLinks {
  const base = dashboardBase();
  return {
    paymentIntent: order.stripePaymentId ? `${base}/payments/${order.stripePaymentId}` : null,
    charge: order.stripeChargeId ? `${base}/payments/${order.stripeChargeId}` : null,
    transfer: order.stripeTransferId ? `${base}/connect/transfers/${order.stripeTransferId}` : null,
    account: order.seller.stripeConnectId
      ? `${base}/connect/accounts/${order.seller.stripeConnectId}`
      : null,
  };
}

export function stripeAccountLink(stripeConnectId: string | null): string | null {
  return stripeConnectId ? `${dashboardBase()}/connect/accounts/${stripeConnectId}` : null;
}

export function clerkUserLink(clerkId: string): string {
  return `https://dashboard.clerk.com/last-active?path=users/${clerkId}`;
}
