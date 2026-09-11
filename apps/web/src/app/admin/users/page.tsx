import { Prisma, prisma } from "@buttergolf/db";
import { enumParam, firstParam, pageParam, paginate } from "@/lib/admin-url";
import { UsersTable } from "./_components/UsersTable";

export const dynamic = "force-dynamic";

const ROLES = ["USER", "SUPPORT", "ADMIN"] as const;
const FLAGS = ["suspended", "deleted", "staff"] as const;
const SELLER = ["onboarded", "pending", "none"] as const;
const SORTS = ["newest", "oldest", "name"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const role = enumParam(params.role, ROLES);
  const flag = enumParam(params.flag, FLAGS);
  const seller = enumParam(params.seller, SELLER);
  const sort = enumParam(params.sort, SORTS) ?? "newest";
  const page = pageParam(params.page);

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { id: q },
      { clerkId: q },
      { stripeConnectId: q },
    ];
  }
  if (role) where.role = role;
  if (flag === "suspended") where.suspendedAt = { not: null };
  if (flag === "deleted") where.isDeleted = true;
  if (flag === "staff") where.role = { in: ["SUPPORT", "ADMIN"] };
  if (seller === "onboarded") where.stripeOnboardingComplete = true;
  if (seller === "pending") {
    where.stripeConnectId = { not: null };
    where.stripeOnboardingComplete = false;
  }
  if (seller === "none") where.stripeConnectId = null;

  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "name"
      ? [{ firstName: "asc" }, { lastName: "asc" }]
      : [{ createdAt: sort === "oldest" ? "asc" : "desc" }];

  const total = await prisma.user.count({ where });
  const { skip, take, totalPages, page: current } = paginate(total, page);

  const users = await prisma.user.findMany({
    where,
    orderBy,
    skip,
    take,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      suspendedAt: true,
      isDeleted: true,
      createdAt: true,
      stripeConnectId: true,
      stripeOnboardingComplete: true,
      _count: { select: { products: true, ordersPurchased: true, ordersSold: true } },
    },
  });

  return (
    <UsersTable
      users={users.map((user) => ({
        ...user,
        suspendedAt: user.suspendedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      }))}
      filters={{ q, role, flag, seller, sort }}
      page={current}
      totalPages={totalPages}
      total={total}
    />
  );
}
