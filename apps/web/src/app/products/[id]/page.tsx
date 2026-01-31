import { notFound } from "next/navigation";
import { prisma } from "@buttergolf/db";
import ProductDetailClient, { type Product } from "./ProductDetailClient";
import { PageHero } from "@/app/_components/marketplace/PageHero";
import { TrustSection } from "@/app/_components/marketplace/TrustSection";
import { NewsletterSection } from "@/app/_components/marketplace/NewsletterSection";
import { FooterSection } from "@/app/_components/marketplace/FooterSection";
import { SimilarItemsSection } from "./_components/SimilarItemsSection";
import type { ProductCardData } from "@buttergolf/app";

export const dynamic = "force-dynamic";

async function getProduct(id: string): Promise<Product | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        category: true,
        brand: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    // Increment view count (fire and forget)
    prisma.product
      .update({
        where: { id },
        data: { views: { increment: 1 } },
      })
      .catch((err) => console.error("Failed to increment views:", err));

    // Transform to match Product interface
    return {
      ...product,
      createdAt: product.createdAt.toISOString(),
      brand: product.brand?.name || null,
    } as Product;
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

async function getSimilarProducts(id: string): Promise<ProductCardData[]> {
  try {
    // Get the current product to find similar ones
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        categoryId: true,
        price: true,
        brand: true,
      },
    });

    if (!product) {
      return [];
    }

    // Find similar products (same category, similar price range)
    const priceMin = product.price * 0.7;
    const priceMax = product.price * 1.3;

    const similarProducts = await prisma.product.findMany({
      where: {
        id: { not: id },
        isSold: false,
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
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    });

    // Map to ProductCardData format
    return similarProducts.map((prod) => ({
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
        averageRating: null,
        ratingCount: 0,
      },
    }));
  } catch (error) {
    console.error("Error fetching similar products:", error);
    return [];
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  // If product not found, show 404
  if (!product) {
    notFound();
  }

  // Fetch similar products
  const similarProducts = await getSimilarProducts(id);

  return (
    <>
      <PageHero />
      <ProductDetailClient product={product} />
      <SimilarItemsSection
        products={similarProducts}
        category={product.category?.name || "Products"}
      />
      <TrustSection />
      <NewsletterSection />
      <FooterSection />
    </>
  );
}
