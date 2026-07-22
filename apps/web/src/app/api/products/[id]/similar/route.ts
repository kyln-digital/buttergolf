import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import type { ProductCardData } from "@buttergolf/app";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get the current product
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        categoryId: true,
        price: true,
        brand: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Find similar products:
    // 1. Same category
    // 2. Similar price range (±30%)
    // 3. Not sold
    // 4. Not the current product
    // 5. Prefer same brand if available
    const priceMin = product.price * 0.7;
    const priceMax = product.price * 1.3;

    const similarProducts = await prisma.product.findMany({
      where: {
        id: { not: id },
        isSold: false,
        isDraft: false,
        user: { is: { isDeleted: false } },
        categoryId: product.categoryId,
        price: {
          gte: priceMin,
          lte: priceMax,
        },
      },
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
            imageUrl: true,
          },
        },
      },
      orderBy: [
        // Then by most recent
        { createdAt: "desc" },
      ],
      take: 8, // Get 8 to have variety
    });

    // Map to ProductCardData format
    const productCards: ProductCardData[] = similarProducts.map((prod) => ({
      id: prod.id,
      title: prod.title,
      price: prod.price,
      condition: prod.condition,
      imageUrl: prod.images[0]?.url || "/placeholder-product.jpg",
      category: prod.category.name,
      seller: {
        id: prod.user.id,
        firstName: prod.user.firstName,
        lastName: prod.user.lastName,
        averageRating: null, // TODO: Calculate from ratings
        ratingCount: 0, // TODO: Get from ratings count
      },
    }));

    return NextResponse.json({
      products: productCards,
      total: productCards.length,
    });
  } catch (error) {
    console.error("Error fetching similar products:", error);
    return NextResponse.json({ error: "Failed to fetch similar products" }, { status: 500 });
  }
}
