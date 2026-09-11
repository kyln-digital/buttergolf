import { Prisma, prisma } from "@buttergolf/db";
import { enumParam, firstParam, pageParam, paginate } from "@/lib/admin-url";
import { IssuesTable } from "./_components/IssuesTable";

export const dynamic = "force-dynamic";

const VIEWS = ["open", "under-review", "resolved", "all"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = enumParam(params.view, VIEWS) ?? "open";
  const highlight = firstParam(params.issue);
  const page = pageParam(params.page);

  const where: Prisma.OrderIssueWhereInput = {};
  if (view === "open") where.status = { in: ["OPEN", "UNDER_REVIEW"] };
  if (view === "under-review") where.status = "UNDER_REVIEW";
  if (view === "resolved") where.status = "RESOLVED";

  const [total, counts] = await Promise.all([
    prisma.orderIssue.count({ where }),
    prisma.orderIssue.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const { skip, take, totalPages, page: current } = paginate(total, page);

  const issues = await prisma.orderIssue.findMany({
    where,
    // Oldest open first: the queue is worked in the order it arrived.
    orderBy: view === "resolved" ? { resolvedAt: "desc" } : { createdAt: "asc" },
    skip,
    take,
    select: {
      id: true,
      orderId: true,
      reason: true,
      status: true,
      resolution: true,
      createdAt: true,
      resolvedAt: true,
      reporter: { select: { firstName: true, lastName: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
      order: {
        select: {
          amountTotal: true,
          paymentHoldStatus: true,
          product: { select: { title: true } },
          seller: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;

  return (
    <IssuesTable
      issues={issues.map((issue) => ({
        id: issue.id,
        orderId: issue.orderId,
        reason: issue.reason,
        status: issue.status,
        resolution: issue.resolution,
        createdAt: issue.createdAt.toISOString(),
        resolvedAt: issue.resolvedAt?.toISOString() ?? null,
        reporter: `${issue.reporter.firstName} ${issue.reporter.lastName}`.trim(),
        resolvedBy: issue.resolvedBy
          ? `${issue.resolvedBy.firstName} ${issue.resolvedBy.lastName}`.trim()
          : null,
        productTitle: issue.order.product.title,
        seller: `${issue.order.seller.firstName} ${issue.order.seller.lastName}`.trim(),
        amountTotal: issue.order.amountTotal,
        paymentHoldStatus: issue.order.paymentHoldStatus,
      }))}
      counts={{
        open: countFor("OPEN"),
        underReview: countFor("UNDER_REVIEW"),
        resolved: countFor("RESOLVED"),
      }}
      view={view}
      highlight={highlight}
      page={current}
      totalPages={totalPages}
      total={total}
    />
  );
}
