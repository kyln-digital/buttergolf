import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma, type ProductCondition } from "@buttergolf/db";
import {
  buildListingWhere,
  getListingOrderBy,
  getListingFilterOptions,
  toParamArray,
  toProductCardData,
  PRODUCT_CARD_INCLUDE,
} from "@/lib/listings";
import { ListingsClient } from "../../listings/ListingsClient";
import { getCategoryBySlug } from "@buttergolf/constants";

interface Props {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    condition?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    brand?: string | string[];
    sort?: string;
    page?: string;
  }>;
}

export const dynamic = "force-dynamic";

async function getCategoryListings(
  categorySlug: string,
  searchParams: Awaited<Props["searchParams"]>
) {
  // Validate category slug
  const category = getCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  const page = parseInt(searchParams.page || "1");
  const limit = 24;
  const skip = (page - 1) * limit;

  const where = buildListingWhere({
    categorySlug,
    conditions: toParamArray(searchParams.condition) as ProductCondition[],
    minPrice: searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined,
    brandIds: toParamArray(searchParams.brand),
  });

  const orderBy = getListingOrderBy(searchParams.sort);

  // Fetch products, count, and category-scoped filter options
  const [products, total, filters] = await Promise.all([
    prisma.product.findMany({
      where,
      include: PRODUCT_CARD_INCLUDE,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
    getListingFilterOptions(categorySlug),
  ]);

  return {
    category,
    products: products.map(toProductCardData),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
    filters,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const data = await getCategoryListings(resolvedParams.slug, resolvedSearchParams);

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "50vh",
          }}
        >
          <div>Loading {data.category.name}...</div>
        </div>
      }
    >
      <ListingsClient
        initialProducts={data.products}
        initialTotal={data.total}
        initialFilters={data.filters}
        initialPage={data.page}
        initialCategory={resolvedParams.slug}
      />
    </Suspense>
  );
}

export async function generateMetadata({ params }: Props) {
  const resolvedParams = await params;
  const category = getCategoryBySlug(resolvedParams.slug);

  if (!category) {
    return {
      title: "Category Not Found | ButterGolf",
      description: "The category you're looking for doesn't exist.",
    };
  }

  return {
    title: `${category.name} | ButterGolf`,
    description:
      category.description ||
      `Shop ${category.name} - Browse our selection of golf ${category.name.toLowerCase()}`,
  };
}
