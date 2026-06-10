import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@buttergolf/db";
import type { ProductCardData } from "@buttergolf/app";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const limitParam = searchParams.get("limit");
    const categoryParam = searchParams.get("category");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        products: [],
        total: 0,
        categories: [],
      });
    }

    const searchTerm = query.trim();
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Build where clause
    const whereClause: Prisma.ProductWhereInput = {
      isSold: false,
      isDraft: false,
      user: { is: { isDeleted: false } },
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
        { model: { contains: searchTerm, mode: "insensitive" } },
        { brand: { name: { contains: searchTerm, mode: "insensitive" } } },
      ],
    };

    // Add category filter if provided
    if (categoryParam) {
      whereClause.category = {
        slug: categoryParam,
      };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
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
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get total count for "View all results" link
    const total = await prisma.product.count({ where: whereClause });

    // Get unique categories from results
    const categories = [...new Set(products.map((p) => p.category.name))].slice(0, 5);

    // Map to ProductCardData format
    const productCards: ProductCardData[] = products
      .filter((product) => product.user) // Filter out products without users
      .map((product) => ({
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

    return NextResponse.json({
      products: productCards,
      total,
      categories,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 });
  }
}
