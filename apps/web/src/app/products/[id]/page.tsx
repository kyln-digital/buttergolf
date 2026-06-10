import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";
import ProductDetailClient, { type Product } from "./ProductDetailClient";
import { PageHero } from "@/app/_components/marketplace/PageHero";
import { TrustSection } from "@/app/_components/marketplace/TrustSection";
import { NewsletterSection } from "@/app/_components/marketplace/NewsletterSection";
import { FooterSection } from "@/app/_components/marketplace/FooterSection";
import { SimilarItemsSection } from "./_components/SimilarItemsSection";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { getBaseUrl } from "@/lib/base-url";
import type { ProductCardData } from "@buttergolf/app";

export const dynamic = "force-dynamic";

// Cached per-request so generateMetadata and the page share one DB read
// (and a single view increment).
const getProduct = cache(async (id: string): Promise<Product | null> => {
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
            isDeleted: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    // Hide products belonging to deleted sellers
    if (product.user?.isDeleted) {
      return null;
    }

    // Drafts are only visible to their owner (linked from the seller hub);
    // everyone else gets a 404.
    if (product.isDraft) {
      const { userId: clerkId } = await auth();
      if (!clerkId) return null;
      const owner = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });
      if (!owner || owner.id !== product.userId) {
        return null;
      }
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
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return { title: "Product not found | ButterGolf" };
  }

  const title = `${product.title} | ButterGolf`;
  const description = (product.description || `Buy ${product.title} on ButterGolf.`).slice(0, 160);
  const image = product.images?.[0]?.url;
  const url = `${getBaseUrl()}/products/${product.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
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
        isDraft: false,
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

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images?.map((img) => img.url) ?? [],
    category: product.category?.name,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "GBP",
      availability: product.isSold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url: `${getBaseUrl()}/products/${product.id}`,
    },
  };

  return (
    <>
      <SeoJsonLd data={productJsonLd} />
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
