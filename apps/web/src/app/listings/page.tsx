import { Suspense } from "react";
import { prisma, type ProductCondition } from "@buttergolf/db";
import {
  buildListingWhere,
  getListingOrderBy,
  getListingFilterOptions,
  toParamArray,
  toProductCardData,
  PRODUCT_CARD_INCLUDE,
} from "@/lib/listings";
import { ListingsClient } from "./ListingsClient";

interface SearchParams {
  category?: string;
  condition?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  brand?: string | string[];
  sort?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export const dynamic = "force-dynamic";

async function getListings(searchParams: SearchParams) {
  const page = Number.parseInt(searchParams.page || "1");
  const limit = 24;
  const skip = (page - 1) * limit;

  const where = buildListingWhere({
    categorySlug: searchParams.category,
    conditions: toParamArray(searchParams.condition) as ProductCondition[],
    minPrice: searchParams.minPrice ? Number.parseFloat(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number.parseFloat(searchParams.maxPrice) : undefined,
    brandIds: toParamArray(searchParams.brand),
  });

  const orderBy = getListingOrderBy(searchParams.sort);

  // Fetch products, total count, and shared filter options
  const [products, total, filters] = await Promise.all([
    prisma.product.findMany({
      where,
      include: PRODUCT_CARD_INCLUDE,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
    getListingFilterOptions(),
  ]);

  return {
    products: products.map(toProductCardData),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
    filters,
  };
}

export default async function ListingsPage({ searchParams }: Readonly<Props>) {
  const resolvedParams = await searchParams;
  const data = await getListings(resolvedParams);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ListingsClient
        initialProducts={data.products}
        initialTotal={data.total}
        initialFilters={data.filters}
        initialPage={data.page}
      />
    </Suspense>
  );
}

export const metadata = {
  title: "Shop All Products | ButterGolf",
  description: "Browse our complete collection of golf equipment and accessories",
};
