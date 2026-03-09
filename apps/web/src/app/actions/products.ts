"use server";

import { prisma } from "@buttergolf/db";
import type { ProductCardData } from "@buttergolf/app";

export async function getRecentProducts(limit: number = 12): Promise<ProductCardData[]> {
  try {
    const products = await prisma.product.findMany({
      take: limit,
      where: {
        isSold: false, // Only show available products
      },
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          orderBy: {
            sortOrder: "asc",
          },
          take: 1, // Only get the first image for card view
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
        // Include active promotions
        promotions: {
          where: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return products
      .filter((product) => product.user) // Filter out products without users
      .map((product) => {
        let imageUrl =
          product.images[0]?.url ||
          "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=400";

        // If the image URL is a relative path (local asset), use it for web but provide fallback for mobile
        // In production, all images should be stored in Vercel Blob with full HTTPS URLs
        if (imageUrl.startsWith("/")) {
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000");

          // Convert to absolute URL for local testing
          imageUrl = `${baseUrl}${imageUrl}`;

          // TODO: In production, replace with actual Vercel Blob upload
          // Example: https://your-bucket.public.blob.vercel-storage.com/product-123.jpg
        }

        return {
          id: product.id,
          title: product.title,
          price: product.price,
          condition: product.condition,
          imageUrl,
          category: product.category.name,
          seller: {
            id: product.user.id,
            firstName: product.user.firstName,
            lastName: product.user.lastName,
            averageRating: product.user.averageRating,
            ratingCount: product.user.ratingCount,
          },
          activePromotion: product.promotions[0]
            ? {
                type: product.promotions[0].type,
                expiresAt: product.promotions[0].expiresAt,
              }
            : null,
        };
      });
  } catch (error) {
    console.error("Failed to fetch recent products:", error);
    return [];
  }
}

export async function getMyProducts(
  clerkId: string,
  limit: number = 12
): Promise<ProductCardData[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return [];

    const products = await prisma.product.findMany({
      take: limit,
      where: {
        userId: user.id,
        isSold: false,
        isDraft: false,
      },
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
        category: {
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
        promotions: {
          where: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return products
      .filter((product) => product.user)
      .map((product) => {
        let imageUrl =
          product.images[0]?.url ||
          "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=400";

        if (imageUrl.startsWith("/")) {
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000");
          imageUrl = `${baseUrl}${imageUrl}`;
        }

        return {
          id: product.id,
          title: product.title,
          price: product.price,
          condition: product.condition,
          imageUrl,
          category: product.category.name,
          seller: {
            id: product.user.id,
            firstName: product.user.firstName,
            lastName: product.user.lastName,
            averageRating: product.user.averageRating,
            ratingCount: product.user.ratingCount,
          },
          activePromotion: product.promotions[0]
            ? {
                type: product.promotions[0].type,
                expiresAt: product.promotions[0].expiresAt,
              }
            : null,
        };
      });
  } catch (error) {
    console.error("Failed to fetch my products:", error);
    return [];
  }
}
