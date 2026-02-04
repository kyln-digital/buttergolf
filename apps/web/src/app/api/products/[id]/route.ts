import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Next.js 16: params is now a Promise
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: {
        id,
      },
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
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Increment view count (fire and forget)
    prisma.product
      .update({
        where: { id },
        data: { views: { increment: 1 } },
      })
      .catch((err) => console.error("Failed to increment views:", err));

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
