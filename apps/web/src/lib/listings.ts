import { Prisma, prisma, type ProductCondition } from "@buttergolf/db";
import type { ProductCardData } from "@buttergolf/app";

/**
 * Shared listing-query building blocks used by /listings, /category/[slug]
 * and /api/listings so the three surfaces can never drift apart (filters,
 * sorting, card shape, and filter options must agree between the SSR pages
 * and the client-refetch API).
 */

export interface ListingFilterParams {
  categorySlug?: string;
  conditions?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  /** Brand *names* from the listings UI `brand` query param (not CUID ids). */
  brandIds?: string[];
}

/** Normalize a string-or-array query param to an array. */
export function toParamArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

/** Base where clause for anything publicly browsable. */
export function buildListingWhere(filters: ListingFilterParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    isSold: false,
    isDraft: false,
    // Keep count/query/render parity by excluding deleted/orphaned sellers at query time.
    user: { is: { isDeleted: false } },
  };

  if (filters.categorySlug) {
    where.category = { slug: filters.categorySlug };
  }
  if (filters.conditions && filters.conditions.length > 0) {
    where.condition = { in: filters.conditions };
  }
  if (filters.minPrice || filters.maxPrice) {
    where.price = {
      ...(filters.minPrice && { gte: filters.minPrice }),
      ...(filters.maxPrice && { lte: filters.maxPrice }),
    };
  }
  if (filters.brandIds && filters.brandIds.length > 0) {
    // UI / BrandFilter pass brand names; Brand.id is a CUID.
    where.brand = { name: { in: filters.brandIds } };
  }

  return where;
}

export type ListingSort = "newest" | "price-asc" | "price-desc" | "popular";

export function getListingOrderBy(
  sort: string | undefined
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { price: "asc" };
    case "price-desc":
      return { price: "desc" };
    case "popular":
      return { views: "desc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

/** Include needed to build a ProductCardData from a product row. */
export const PRODUCT_CARD_INCLUDE = {
  images: {
    orderBy: { sortOrder: "asc" as const },
    take: 1,
  },
  category: {
    select: { id: true, name: true, slug: true },
  },
  brand: {
    select: { id: true, name: true, slug: true },
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      averageRating: true,
      ratingCount: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductCardRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_CARD_INCLUDE }> & {
  promotions?: { id: string }[];
};

export function toProductCardData(
  product: ProductCardRow
): ProductCardData & { isPromoted?: boolean } {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    condition: product.condition,
    imageUrl: product.images[0]?.url || "/placeholder-product.jpg",
    category: product.category.name,
    seller: {
      id: product.user.id,
      firstName: product.user.firstName,
      lastName: product.user.lastName,
      averageRating: product.user.averageRating,
      ratingCount: product.user.ratingCount,
    },
    ...(product.promotions !== undefined && {
      isPromoted: product.promotions.length > 0,
    }),
  };
}

/**
 * Filter sidebar options: brands with live stock and the overall price range,
 * optionally scoped to a category. Single implementation so the SSR pages and
 * the refetch API agree.
 */
export async function getListingFilterOptions(categorySlug?: string) {
  const productScope = {
    isSold: false,
    isDraft: false,
    ...(categorySlug && { category: { slug: categorySlug } }),
  };

  const [availableBrands, priceAgg] = await Promise.all([
    prisma.brand.findMany({
      where: {
        products: { some: productScope },
      },
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.aggregate({
      where: productScope,
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    availableBrands: availableBrands.map((b) => b.name),
    priceRange: {
      min: priceAgg._min.price || 0,
      max: priceAgg._max.price || 10000,
    },
  };
}
