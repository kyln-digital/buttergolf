import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/seller/listings
 *
 * Fetches authenticated user's product listings with stats
 * Query params:
 * - status: 'all' | 'active' | 'sold' (default: 'all')
 * - sort: 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'views' (default: 'newest')
 * - page: number (default: 1)
 * - limit: number (default: 12)
 */
export async function GET(request: NextRequest) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(request);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "newest";
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      userId: user.id,
    };

    if (status === "active") {
      where.isSold = false;
    } else if (status === "sold") {
      where.isSold = true;
    }

    // Build order by clause
    let orderBy: Prisma.ProductOrderByWithRelationInput;

    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "price-asc":
        orderBy = { price: "asc" };
        break;
      case "price-desc":
        orderBy = { price: "desc" };
        break;
      case "views":
        orderBy = { views: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    // Fetch products with stats
    const [products, total, stats] = await Promise.all([
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
          offers: {
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
          favourites: {
            select: {
              id: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
      // Get aggregated stats for dashboard
      prisma.product.aggregate({
        where: { userId: user.id },
        _count: true,
        _sum: { views: true },
      }),
    ]);

    // Calculate active/sold counts
    const activeCount = await prisma.product.count({
      where: { userId: user.id, isSold: false },
    });

    const soldCount = await prisma.product.count({
      where: { userId: user.id, isSold: true },
    });

    // Count pending offers across all products
    const pendingOffersCount = await prisma.offer.count({
      where: {
        sellerId: user.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      products: products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        condition: product.condition,
        brandId: product.brandId,
        brandName: product.brand?.name || null,
        model: product.model,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        imageUrl: product.images[0]?.url || "/placeholder-product.jpg",
        isSold: product.isSold,
        views: product.views,
        favourites: product.favourites.length,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        images: product.images.map((img) => img.url),
        offersCount: product.offers.length,
        pendingOffersCount: product.offers.filter((o) => o.status === "PENDING").length,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
      stats: {
        totalListings: stats._count,
        activeListings: activeCount,
        soldListings: soldCount,
        totalViews: stats._sum.views || 0,
        totalFavourites: products.reduce((sum, product) => sum + product.favourites.length, 0),
        pendingOffers: pendingOffersCount,
      },
    });
  } catch (error) {
    console.error("Error fetching seller listings:", error);
    return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 });
  }
}
