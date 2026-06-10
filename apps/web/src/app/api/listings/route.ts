import { NextRequest, NextResponse } from "next/server";
import { prisma, ProductCondition } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  buildListingWhere,
  getListingOrderBy,
  getListingFilterOptions,
  toProductCardData,
  PRODUCT_CARD_INCLUDE,
} from "@/lib/listings";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "24");
    const skip = (page - 1) * limit;

    // Shared filter building (same logic as /listings and /category SSR pages)
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const where = buildListingWhere({
      categorySlug: searchParams.get("category") || undefined,
      conditions: searchParams.getAll("condition") as ProductCondition[],
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      brandIds: searchParams.getAll("brand"),
    });

    // Favourites filter (requires authentication)
    const showFavouritesOnly = searchParams.get("favourites") === "true";
    if (showFavouritesOnly) {
      // Support both web cookies and mobile Bearer tokens
      const clerkId = await getUserIdFromRequest(request);

      if (!clerkId) {
        return NextResponse.json(
          { error: "Authentication required to filter favourites" },
          { status: 401 }
        );
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        // User not synced yet, return empty results
        return NextResponse.json({
          products: [],
          pagination: {
            page: 1,
            limit: 24,
            totalPages: 0,
            totalCount: 0,
          },
        });
      }

      where.favourites = {
        some: {
          userId: user.id,
        },
      };
    }

    // Search query
    const query = searchParams.get("q");
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { model: { contains: query, mode: "insensitive" } },
        { brand: { name: { contains: query, mode: "insensitive" } } },
      ];
    }

    // Sort options (shared mapping)
    const orderBy = getListingOrderBy(searchParams.get("sort") || undefined);

    // Fetch products with active promotions
    // Products with active BUMP promotions appear first (boosted visibility)
    const [products, total, filters] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          ...PRODUCT_CARD_INCLUDE,
          // Include active promotions for boost sorting
          promotions: {
            where: {
              status: "ACTIVE",
              expiresAt: { gt: new Date() },
            },
            select: {
              id: true,
              type: true,
              expiresAt: true,
            },
          },
        },
        // We can't directly sort by promotion count in Prisma
        // So we fetch more and sort in memory, or use raw query
        // For now, we'll use a simple approach and sort in memory
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
      getListingFilterOptions(searchParams.get("category") || undefined),
    ]);

    // Sort products: promoted items first, then by selected sort
    const sortedProducts = [...products].sort((a, b) => {
      const aHasPromo = a.promotions && a.promotions.length > 0;
      const bHasPromo = b.promotions && b.promotions.length > 0;

      // Promoted products come first
      if (aHasPromo && !bHasPromo) return -1;
      if (!aHasPromo && bHasPromo) return 1;

      // If both have or don't have promotions, maintain original order
      return 0;
    });

    // Map to ProductCardData format (using sorted products with promotion boost)
    const productCards = sortedProducts.map(toProductCardData);

    return NextResponse.json({
      products: productCards,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
      filters,
    });
  } catch (error) {
    console.error("Listings API error:", error);
    return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 });
  }
}
