import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";

/**
 * GET /api/brands?query=cal
 *
 * Fuzzy search for golf brands with autocomplete support
 * Returns brands sorted by relevance and popularity (sortOrder)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.toLowerCase() || "";

    // If no query, return all brands sorted by sortOrder
    if (!query) {
      const brands = await prisma.brand.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      });
      return NextResponse.json(brands);
    }

    // Fuzzy search: match brands where name starts with query OR contains query
    const brands = await prisma.brand.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [
        { sortOrder: "asc" }, // Prioritize popular brands
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
      },
      take: 10, // Limit to 10 results for autocomplete
    });

    // Sort results: exact matches first, then starts-with, then contains
    const sortedBrands = brands.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();

      // Exact match first
      if (aLower === query) return -1;
      if (bLower === query) return 1;

      // Starts with query second
      if (aLower.startsWith(query) && !bLower.startsWith(query)) return -1;
      if (bLower.startsWith(query) && !aLower.startsWith(query)) return 1;

      // Otherwise maintain sortOrder
      return 0;
    });

    return NextResponse.json(sortedBrands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
}
