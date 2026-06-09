import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma, Prisma, ProductCondition } from "@buttergolf/db";
import type { ProductCardData } from "@buttergolf/app";
import { ListingsClient } from "../../listings/ListingsClient";
import { getCategoryBySlug } from "@buttergolf/db";

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

  // Build where clause - start with category filter
  const where: Prisma.ProductWhereInput = {
    isSold: false,
    isDraft: false,
    category: { slug: categorySlug },
    // Keep count/query/render parity by excluding orphaned seller relations at query time.
    user: { is: {} },
  };

  // Condition filter
  const conditions = (
    Array.isArray(searchParams.condition)
      ? searchParams.condition
      : searchParams.condition
        ? [searchParams.condition]
        : []
  ) as ProductCondition[];
  if (conditions.length > 0) {
    where.condition = { in: conditions };
  }

  // Price range
  const minPrice = searchParams.minPrice ? parseFloat(searchParams.minPrice) : undefined;
  const maxPrice = searchParams.maxPrice ? parseFloat(searchParams.maxPrice) : undefined;
  if (minPrice || maxPrice) {
    where.price = {
      ...(minPrice && { gte: minPrice }),
      ...(maxPrice && { lte: maxPrice }),
    };
  }

  // Brand filter
  const brands = Array.isArray(searchParams.brand)
    ? searchParams.brand
    : searchParams.brand
      ? [searchParams.brand]
      : [];
  if (brands.length > 0) {
    where.brandId = { in: brands };
  }

  // Sort options
  const sort = searchParams.sort || "newest";
  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };

  switch (sort) {
    case "price-asc":
      orderBy = { price: "asc" };
      break;
    case "price-desc":
      orderBy = { price: "desc" };
      break;
    case "popular":
      orderBy = { views: "desc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  // Fetch products and aggregations
  const [products, total, availableBrands, priceAgg] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
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
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
    prisma.brand.findMany({
      where: {
        products: {
          some: {
            isSold: false,
            isDraft: false,
            category: { slug: categorySlug },
          },
        },
      },
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.aggregate({
      where: {
        isSold: false,
        isDraft: false,
        category: { slug: categorySlug },
      },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  // Map to ProductCardData format
  const productCards: ProductCardData[] = products.map((product) => ({
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
  }));

  return {
    category,
    products: productCards,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
    filters: {
      availableBrands: availableBrands.map((b) => b.name),
      priceRange: {
        min: priceAgg._min.price || 0,
        max: priceAgg._max.price || 10000,
      },
    },
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
