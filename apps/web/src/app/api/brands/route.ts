import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";

/**
 * Reduce a search term to slug form so punctuation and spacing don't matter.
 *
 * Brand names carry punctuation their slugs drop, so a contiguous `contains`
 * against the name alone misses the spellings people actually type: "LAB Golf",
 * "L.A.B Golf" and "L.A.B. Golf" must all reach "lab-golf". Dots and apostrophes
 * are stripped rather than turned into separators, so an acronym collapses into
 * one word ("l.a.b" -> "lab") instead of splitting ("l-a-b"); everything else
 * becomes a single hyphen, matching how the slugs themselves are written.
 */
function slugifyQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[.'\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
    const slugQuery = slugifyQuery(query);
    const brands = await prisma.brand.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          // Only worth a third clause when slugifying actually changed the term.
          ...(slugQuery && slugQuery !== query
            ? [{ slug: { contains: slugQuery, mode: "insensitive" as const } }]
            : []),
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
