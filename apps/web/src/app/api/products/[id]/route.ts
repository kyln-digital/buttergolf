import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Next.js 16: params is now a Promise
    const { id } = await params;

    // Public must not retrieve unpublished drafts by ID. Authenticated owners
    // may load their own drafts (SellFormClient draft resume).
    const clerkId = await getUserIdFromRequest(request);
    let ownerUserId: string | null = null;
    if (clerkId) {
      const owner = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });
      ownerUserId = owner?.id ?? null;
    }

    const product = await prisma.product.findFirst({
      where: {
        id,
        ...(ownerUserId
          ? {
              // Public published listings stay draft/deleted-seller blocked;
              // owner may still load own drafts for SellFormClient resume.
              OR: [
                { isDraft: false, user: { is: { isDeleted: false } } },
                { isDraft: true, userId: ownerUserId },
              ],
            }
          : { isDraft: false, user: { is: { isDeleted: false } } }),
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

    // Only count public listing views — draft resume must not inflate metrics.
    if (!product.isDraft) {
      prisma.product
        .update({
          where: { id },
          data: { views: { increment: 1 } },
        })
        .catch((err) => console.error("Failed to increment views:", err));
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
