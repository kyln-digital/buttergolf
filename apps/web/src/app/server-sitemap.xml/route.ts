import { getServerSideSitemap } from "next-sitemap";
import { prisma } from "@buttergolf/db";
import type { ISitemapField } from "next-sitemap";

// Enable ISR (Incremental Static Regeneration)
// Revalidate every 6 hours (21600 seconds)
export const revalidate = 21600;

export async function GET() {
  const siteUrl = process.env.SITE_URL || "https://www.buttergolf.com";

  try {
    // Fetch all products from the database
    const products = await prisma.product.findMany({
      where: {
        isSold: false, // Only include available products
        isDraft: false,
        user: { is: { isDeleted: false } },
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    const fields: ISitemapField[] = [
      // Static pages
      {
        loc: siteUrl,
        lastmod: new Date().toISOString(),
        changefreq: "daily" as const,
        priority: 1,
      },
      {
        loc: `${siteUrl}/sell`,
        lastmod: new Date().toISOString(),
        changefreq: "monthly" as const,
        priority: 0.9,
      },
      {
        loc: `${siteUrl}/rounds`,
        lastmod: new Date().toISOString(),
        changefreq: "monthly" as const,
        priority: 0.6,
      },
      // Dynamic product pages
      ...products.map((product) => ({
        loc: `${siteUrl}/products/${product.id}`,
        lastmod: product.updatedAt.toISOString(),
        changefreq: "weekly" as const,
        priority: 0.8,
      })),
    ];

    return getServerSideSitemap(fields);
  } catch (error) {
    console.error("Error generating sitemap:", error);

    // Return fallback sitemap with static pages only
    const fallbackFields: ISitemapField[] = [
      {
        loc: siteUrl,
        lastmod: new Date().toISOString(),
        changefreq: "daily" as const,
        priority: 1,
      },
      {
        loc: `${siteUrl}/sell`,
        lastmod: new Date().toISOString(),
        changefreq: "monthly" as const,
        priority: 0.9,
      },
      {
        loc: `${siteUrl}/rounds`,
        lastmod: new Date().toISOString(),
        changefreq: "monthly" as const,
        priority: 0.6,
      },
    ];

    return getServerSideSitemap(fallbackFields);
  }
}
