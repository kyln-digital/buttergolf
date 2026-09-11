import { Prisma, prisma } from "@buttergolf/db";
import { daysAgo } from "@/lib/admin-dates";
import { enumParam, firstParam, pageParam, paginate } from "@/lib/admin-url";
import { OrdersTable } from "./_components/OrdersTable";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "PAYMENT_CONFIRMED",
  "LABEL_GENERATED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
const HOLD_STATUSES = [
  "HELD",
  "PENDING_SELLER_ONBOARDING",
  "RELEASED",
  "DISPUTED",
  "REFUNDED",
] as const;
const QUEUES = ["issues", "disputed", "stuck-payouts", "label-failures", "unshipped"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const status = enumParam(params.status, ORDER_STATUSES);
  const hold = enumParam(params.hold, HOLD_STATUSES);
  const queue = enumParam(params.queue, QUEUES);
  const page = pageParam(params.page);

  const where: Prisma.OrderWhereInput = {};
  if (q) {
    where.OR = [
      { id: q },
      { stripePaymentId: q },
      { stripeChargeId: q },
      { stripeTransferId: q },
      { stripeCheckoutId: q },
      { buyer: { email: { contains: q, mode: "insensitive" } } },
      { seller: { email: { contains: q, mode: "insensitive" } } },
      { product: { title: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;
  if (hold) where.paymentHoldStatus = hold;

  switch (queue) {
    case "issues":
      where.issue = { is: { status: { not: "RESOLVED" } } };
      break;
    case "disputed":
      where.paymentHoldStatus = "DISPUTED";
      break;
    case "stuck-payouts":
      where.AND = [
        {
          OR: [
            { paymentHoldStatus: "PENDING_SELLER_ONBOARDING" },
            { paymentHoldStatus: "RELEASED", stripeTransferId: null },
          ],
        },
      ];
      break;
    case "label-failures":
      where.labelError = { not: null };
      where.labelUrl = null;
      where.status = "PAYMENT_CONFIRMED";
      break;
    case "unshipped":
      where.status = { in: ["PAYMENT_CONFIRMED", "LABEL_GENERATED"] };
      where.createdAt = { lt: daysAgo(5) };
      break;
  }

  const total = await prisma.order.count({ where });
  const { skip, take, totalPages, page: current } = paginate(total, page);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      createdAt: true,
      amountTotal: true,
      status: true,
      paymentHoldStatus: true,
      shipmentStatus: true,
      labelError: true,
      product: { select: { title: true } },
      buyer: { select: { id: true, firstName: true, lastName: true } },
      seller: { select: { id: true, firstName: true, lastName: true } },
      issue: { select: { status: true } },
    },
  });

  return (
    <OrdersTable
      orders={orders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        amountTotal: order.amountTotal,
        status: order.status,
        paymentHoldStatus: order.paymentHoldStatus,
        shipmentStatus: order.shipmentStatus,
        labelError: order.labelError,
        productTitle: order.product.title,
        buyer: order.buyer,
        seller: order.seller,
        issueStatus: order.issue?.status ?? null,
      }))}
      filters={{ q, status, hold, queue }}
      page={current}
      totalPages={totalPages}
      total={total}
    />
  );
}
