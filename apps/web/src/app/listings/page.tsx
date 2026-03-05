import { Suspense } from "react";
import { prisma, Prisma, ProductCondition } from "@buttergolf/db";
import type { ProductCardData } from "@buttergolf/app";
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

  // Build where clause
  const where: Prisma.ProductWhereInput = {
    isSold: false,
    // Keep count/query/render parity by excluding orphaned seller relations at query time.
    user: { is: {} },
  };

  if (searchParams.category) {
    where.category = { slug: searchParams.category };
  }

  let conditions: ProductCondition[] = [];
  if (Array.isArray(searchParams.condition)) {
    conditions = searchParams.condition as ProductCondition[];
  } else if (searchParams.condition) {
    conditions = [searchParams.condition as ProductCondition];
  }
  if (conditions.length > 0) {
    where.condition = { in: conditions };
  }

  const minPrice = searchParams.minPrice ? Number.parseFloat(searchParams.minPrice) : undefined;
  const maxPrice = searchParams.maxPrice ? Number.parseFloat(searchParams.maxPrice) : undefined;
  if (minPrice || maxPrice) {
    where.price = {
      ...(minPrice && { gte: minPrice }),
      ...(maxPrice && { lte: maxPrice }),
    };
  }

  let brands: string[] = [];
  if (Array.isArray(searchParams.brand)) {
    brands = searchParams.brand;
  } else if (searchParams.brand) {
    brands = [searchParams.brand];
  }
  if (brands.length > 0) {
    where.brandId = { in: brands };
  }

  // Sort options
  const sort = searchParams.sort || "newest";
  let orderBy: Prisma.ProductOrderByWithRelationInput;

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

  // Fetch products and total count.
  // Build scoped where clauses for filter sidebar aggregations:
  // - whereForBrands: all current filters minus brandId, so the brand list shows every brand
  //   available in the current category/condition/price context (not just the selected brand).
  // - whereForPrice: all current filters minus price, so the slider shows the full price range
  //   available for the current category/condition/brand context.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { brandId: _brandId, ...whereForBrands } = where;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { price: _price, ...whereForPrice } = where;

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
          some: whereForBrands,
        },
      },
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.aggregate({
      where: whereForPrice,
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
