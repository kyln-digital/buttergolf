import { Prisma, prisma } from "@buttergolf/db";
import { firstParam, pageParam, paginate } from "@/lib/admin-url";
import { AuditTable } from "./_components/AuditTable";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const actor = firstParam(params.actor);
  const targetType = firstParam(params.type);
  const page = pageParam(params.page);

  const where: Prisma.AdminActionWhereInput = {};
  if (q) {
    where.OR = [{ action: { contains: q, mode: "insensitive" } }, { targetId: q }];
  }
  if (actor) where.actorId = actor;
  if (targetType) where.targetType = targetType;

  const [total, actors] = await Promise.all([
    prisma.adminAction.count({ where }),
    prisma.user.findMany({
      where: { OR: [{ role: { in: ["SUPPORT", "ADMIN"] } }, { adminActions: { some: {} } }] },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }],
    }),
  ]);
  const { skip, take, totalPages, page: current } = paginate(total, page, 50);

  const actions = await prisma.adminAction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return (
    <AuditTable
      actions={actions.map((entry) => ({
        id: entry.id,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt: entry.createdAt.toISOString(),
        actor: {
          id: entry.actor.id,
          name: `${entry.actor.firstName} ${entry.actor.lastName}`.trim(),
        },
      }))}
      actors={actors.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
      }))}
      filters={{ q, actor, type: targetType }}
      page={current}
      totalPages={totalPages}
      total={total}
    />
  );
}
