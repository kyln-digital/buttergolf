import { prisma } from "@buttergolf/db";
import { getAdminForPage } from "@/lib/admin-auth";
import { can } from "@/lib/admin-permissions";
import { enumParam, firstParam, pageParam, paginate } from "@/lib/admin-url";
import { ReferenceView } from "./_components/ReferenceView";

export const dynamic = "force-dynamic";

const TABS = ["brands", "categories", "models"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminReferencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = enumParam(params.tab, TABS) ?? "brands";
  const q = firstParam(params.q);
  const page = pageParam(params.page);

  const admin = await getAdminForPage();
  const canManage = admin ? can(admin.role, "reference.manage") : false;

  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        sortOrder: true,
        _count: { select: { products: true, clubModels: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    }),
  ]);

  // Club models are the big table (thousands of rows from the fixture), so
  // they are searched and paged rather than loaded whole.
  const modelWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { brand: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const modelTotal = await prisma.clubModel.count({ where: modelWhere });
  const { skip, take, totalPages, page: current } = paginate(modelTotal, page, 50);
  const models = await prisma.clubModel.findMany({
    where: modelWhere,
    orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    skip,
    take,
    select: {
      id: true,
      name: true,
      kind: true,
      isVerified: true,
      usageCount: true,
      brand: { select: { id: true, name: true } },
    },
  });

  return (
    <ReferenceView
      tab={tab}
      brands={brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        sortOrder: brand.sortOrder,
        products: brand._count.products,
        models: brand._count.clubModels,
      }))}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
        products: category._count.products,
      }))}
      models={{ rows: models, q, page: current, totalPages, total: modelTotal }}
      canManage={canManage}
    />
  );
}
