import { prisma } from "@buttergolf/db";
import { daysAgo } from "@/lib/admin-dates";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/listings";
import { DashboardView } from "./_components/DashboardView";

export const dynamic = "force-dynamic";

/**
 * /admin — the things that need a human today, plus a few health numbers.
 */
export default async function AdminDashboardPage() {
  const fiveDaysAgo = daysAgo(5);
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);

  const [
    openIssues,
    disputedOrders,
    stuckPayouts,
    labelFailures,
    unshipped,
    newUsers,
    gmv,
    ordersThirtyDays,
    activeListings,
    recentIssues,
    recentActions,
  ] = await Promise.all([
    prisma.orderIssue.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.order.count({ where: { paymentHoldStatus: "DISPUTED" } }),
    prisma.order.count({
      where: {
        OR: [
          { paymentHoldStatus: "PENDING_SELLER_ONBOARDING" },
          { paymentHoldStatus: "RELEASED", stripeTransferId: null },
        ],
      },
    }),
    prisma.order.count({
      where: { labelError: { not: null }, labelUrl: null, status: "PAYMENT_CONFIRMED" },
    }),
    prisma.order.count({
      where: {
        status: { in: ["PAYMENT_CONFIRMED", "LABEL_GENERATED"] },
        createdAt: { lt: fiveDaysAgo },
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo }, isDeleted: false } }),
    prisma.order.aggregate({
      _sum: { amountTotal: true },
      where: { createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    }),
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.product.count({ where: PUBLIC_PRODUCT_WHERE }),
    prisma.orderIssue.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        orderId: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: { select: { firstName: true, lastName: true } },
        order: { select: { product: { select: { title: true } } } },
      },
    }),
    prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        actor: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <DashboardView
      stats={{
        openIssues,
        disputedOrders,
        stuckPayouts,
        labelFailures,
        unshipped,
        newUsers,
        gmvThirtyDays: gmv._sum.amountTotal ?? 0,
        ordersThirtyDays,
        activeListings,
      }}
      recentIssues={recentIssues.map((issue) => ({
        id: issue.id,
        orderId: issue.orderId,
        reason: issue.reason,
        status: issue.status,
        createdAt: issue.createdAt.toISOString(),
        reporter: `${issue.reporter.firstName} ${issue.reporter.lastName}`.trim(),
        productTitle: issue.order.product.title,
      }))}
      recentActions={recentActions.map((action) => ({
        id: action.id,
        action: action.action,
        targetType: action.targetType,
        targetId: action.targetId,
        createdAt: action.createdAt.toISOString(),
        actor: `${action.actor.firstName} ${action.actor.lastName}`.trim(),
      }))}
    />
  );
}
