import { notFound } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { getAdminForPage } from "@/lib/admin-auth";
import { can } from "@/lib/admin-permissions";
import { stripeLinksForOrder } from "@/lib/stripe-links";
import { OrderAdminDetail } from "../_components/OrderAdminDetail";

export const dynamic = "force-dynamic";

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [admin, order] = await Promise.all([
    getAdminForPage(),
    prisma.order.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            isSold: true,
            hiddenAt: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          },
        },
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            stripeConnectId: true,
            stripeOnboardingComplete: true,
          },
        },
        fromAddress: true,
        toAddress: true,
        issue: {
          include: {
            reporter: { select: { firstName: true, lastName: true } },
            resolvedBy: { select: { firstName: true, lastName: true } },
          },
        },
        sellerRating: { select: { rating: true, comment: true } },
        conversation: { select: { id: true, _count: { select: { messages: true } } } },
      },
    }),
  ]);

  if (!admin) notFound();
  if (!order) notFound();

  const auditTrail = await prisma.adminAction.findMany({
    where: {
      OR: [
        { targetType: "order", targetId: order.id },
        ...(order.issue ? [{ targetType: "issue", targetId: order.issue.id }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  });

  const formatAddress = (address: typeof order.toAddress) =>
    [address.name, address.street1, address.street2, address.city, address.zip, address.country]
      .filter(Boolean)
      .join(", ");

  return (
    <OrderAdminDetail
      order={{
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        shipmentStatus: order.shipmentStatus,
        paymentHoldStatus: order.paymentHoldStatus,
        amountTotal: order.amountTotal,
        shippingCost: order.shippingCost,
        buyerProtectionFee: order.buyerProtectionFee,
        stripePlatformFee: order.stripePlatformFee,
        stripeSellerPayout: order.stripeSellerPayout,
        stripePaymentId: order.stripePaymentId,
        stripeChargeId: order.stripeChargeId,
        stripeTransferId: order.stripeTransferId,
        paymentReleasedAt: iso(order.paymentReleasedAt),
        autoReleaseAt: iso(order.autoReleaseAt),
        buyerConfirmedAt: iso(order.buyerConfirmedAt),
        shippingServiceName: order.shippingServiceName,
        carrier: order.carrier,
        service: order.service,
        trackingCode: order.trackingCode,
        trackingUrl: order.trackingUrl,
        labelUrl: order.labelUrl,
        labelError: order.labelError,
        labelAttemptedAt: iso(order.labelAttemptedAt),
        labelGeneratedAt: iso(order.labelGeneratedAt),
        shippedAt: iso(order.shippedAt),
        deliveredAt: iso(order.deliveredAt),
        estimatedDelivery: iso(order.estimatedDelivery),
        product: {
          id: order.product.id,
          title: order.product.title,
          price: order.product.price,
          isSold: order.product.isSold,
          hidden: Boolean(order.product.hiddenAt),
          imageUrl: order.product.images[0]?.url ?? null,
        },
        buyer: order.buyer,
        seller: {
          id: order.seller.id,
          firstName: order.seller.firstName,
          lastName: order.seller.lastName,
          email: order.seller.email,
          stripeConnectId: order.seller.stripeConnectId,
          stripeOnboardingComplete: order.seller.stripeOnboardingComplete,
        },
        fromAddress: formatAddress(order.fromAddress),
        toAddress: formatAddress(order.toAddress),
        rating: order.sellerRating,
        conversation: order.conversation
          ? { id: order.conversation.id, messages: order.conversation._count.messages }
          : null,
        issue: order.issue
          ? {
              id: order.issue.id,
              reason: order.issue.reason,
              description: order.issue.description,
              status: order.issue.status,
              resolution: order.issue.resolution,
              resolutionNote: order.issue.resolutionNote,
              createdAt: order.issue.createdAt.toISOString(),
              resolvedAt: iso(order.issue.resolvedAt),
              reporter: `${order.issue.reporter.firstName} ${order.issue.reporter.lastName}`.trim(),
              resolvedBy: order.issue.resolvedBy
                ? `${order.issue.resolvedBy.firstName} ${order.issue.resolvedBy.lastName}`.trim()
                : null,
            }
          : null,
      }}
      links={stripeLinksForOrder(order)}
      auditTrail={auditTrail.map((entry) => ({
        id: entry.id,
        action: entry.action,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt: entry.createdAt.toISOString(),
        actor: `${entry.actor.firstName} ${entry.actor.lastName}`.trim(),
      }))}
      viewer={{
        canRefund: can(admin.role, "orders.refund"),
        canRelease: can(admin.role, "orders.release"),
        canHold: can(admin.role, "orders.hold"),
        canShipment: can(admin.role, "orders.shipment"),
        canTriage: can(admin.role, "issues.triage"),
        canResolve: can(admin.role, "issues.resolve"),
      }}
    />
  );
}
