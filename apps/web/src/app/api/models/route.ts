import { NextResponse } from "next/server";
import { prisma, Prisma, ClubKind } from "@buttergolf/db";

/**
 * GET /api/models?brandId=xxx&query=apex&kind=DRIVER
 *
 * Returns model suggestions for a specific brand
 * Suggests existing models (sorted by usage count) that match the query
 * Used for autocomplete when user types a model name
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    const query = searchParams.get("query")?.toLowerCase() || "";
    const kind = searchParams.get("kind") as ClubKind | null;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    // Build where clause
    const where: Prisma.ClubModelWhereInput = {
      brandId,
    };

    // Add kind filter if provided
    if (kind) {
      where.kind = kind;
    }

    // Add query filter if provided
    if (query) {
      where.name = {
        contains: query,
        mode: "insensitive",
      };
    }

    // Find matching club models, sorted by usage (popularity)
    const models = await prisma.clubModel.findMany({
      where,
      orderBy: [
        { isVerified: "desc" }, // Verified models first
        { usageCount: "desc" }, // Most popular models next
        { name: "asc" }, // Alphabetical as tiebreaker
      ],
      select: {
        id: true,
        name: true,
        kind: true,
        isVerified: true,
        usageCount: true,
      },
      take: 10, // Limit to 10 suggestions
    });

    // Also get all products with matching models (for suggestions from product data)
    const productModels = await prisma.product.findMany({
      where: {
        brandId,
        model: query
          ? {
              contains: query,
              mode: "insensitive",
            }
          : undefined,
      },
      select: {
        model: true,
      },
      distinct: ["model"],
      take: 5,
    });

    // Combine club models and product models
    const allSuggestions = [
      ...models.map((m) => ({
        id: m.id,
        name: m.name,
        source: "clubModel" as const,
        isVerified: m.isVerified,
        usageCount: m.usageCount,
      })),
      ...productModels
        .filter(
          (p) => p.model && !models.some((m) => m.name.toLowerCase() === p.model?.toLowerCase())
        )
        .map((p) => ({
          id: null,
          name: p.model!,
          source: "product" as const,
          isVerified: false,
          usageCount: 0,
        })),
    ];

    return NextResponse.json(allSuggestions);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
