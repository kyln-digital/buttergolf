import { Prisma, prisma } from "@buttergolf/db";
import { getAdminForPage } from "@/lib/admin-auth";
import { can } from "@/lib/admin-permissions";
import { enumParam, firstParam, pageParam, paginate } from "@/lib/admin-url";
import { resolveCoverUrl } from "@/lib/product-images";
import { ListingsTable } from "./_components/ListingsTable";

export const dynamic = "force-dynamic";

const STATES = ["live", "hidden", "draft", "sold"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const state = enumParam(params.state, STATES);
  const page = pageParam(params.page);

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { id: q },
      { title: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { userId: q },
    ];
  }
  switch (state) {
    case "live":
      where.isDraft = false;
      where.isSold = false;
      where.hiddenAt = null;
      break;
    case "hidden":
      where.hiddenAt = { not: null };
      break;
    case "draft":
      where.isDraft = true;
      break;
    case "sold":
      where.isSold = true;
      break;
  }

  const [admin, total] = await Promise.all([getAdminForPage(), prisma.product.count({ where })]);
  const { skip, take, totalPages, page: current } = paginate(total, page);

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      title: true,
      price: true,
      isSold: true,
      isDraft: true,
      hiddenAt: true,
      hiddenReason: true,
      views: true,
      createdAt: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      user: { select: { id: true, firstName: true, lastName: true, suspendedAt: true } },
      _count: { select: { orders: true, favourites: true } },
    },
  });

  return (
    <ListingsTable
      listings={products.map((product) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        isSold: product.isSold,
        isDraft: product.isDraft,
        hiddenAt: product.hiddenAt?.toISOString() ?? null,
        hiddenReason: product.hiddenReason,
        views: product.views,
        createdAt: product.createdAt.toISOString(),
        category: product.category.name,
        brand: product.brand?.name ?? null,
        imageUrl: resolveCoverUrl(product.images),
        seller: {
          id: product.user.id,
          firstName: product.user.firstName,
          lastName: product.user.lastName,
          suspended: Boolean(product.user.suspendedAt),
        },
        orders: product._count.orders,
        favourites: product._count.favourites,
      }))}
      filters={{ q, state }}
      page={current}
      totalPages={totalPages}
      total={total}
      viewer={{
        canHide: admin ? can(admin.role, "listings.hide") : false,
        canEdit: admin ? can(admin.role, "listings.edit") : false,
      }}
    />
  );
}
