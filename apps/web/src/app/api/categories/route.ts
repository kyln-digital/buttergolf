import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        sortOrder: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
