import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { PUBLIC_SELLER_FILTER } from "@/lib/listings";
import { getUserIdFromRequest } from "@/lib/auth";
import { resolveImageUrl } from "@/lib/product-images";
import { recordProductView } from "@/lib/product-views";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Next.js 16: params is now a Promise
    const { id } = await params;

    // The signed-in viewer, if any. Public callers must not retrieve
    // unpublished drafts by ID; owners may load their own (draft resume).
    const clerkId = await getUserIdFromRequest(request);
    let viewerUserId: string | null = null;
    if (clerkId) {
      const owner = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });
      viewerUserId = owner?.id ?? null;
    }

    const product = await prisma.product.findFirst({
      where: {
        id,
        ...(viewerUserId
          ? {
              // Public published listings stay draft/deleted-seller blocked;
              // owner may still load own drafts for SellFormClient resume.
              OR: [
                { isDraft: false, hiddenAt: null, user: PUBLIC_SELLER_FILTER },
                { isDraft: true, userId: viewerUserId },
              ],
            }
          : { isDraft: false, hiddenAt: null, user: PUBLIC_SELLER_FILTER }),
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

    // Shared with the server-rendered product page so the two can't disagree
    // about what counts as a buyer view.
    recordProductView(id, {
      isDraft: product.isDraft,
      ownerUserId: product.userId,
      viewerUserId,
    });

    // `url` stays raw so the sell form can save it back untouched; `displayUrl`
    // carries the brand treatment for the cover so clients (mobile detail
    // screen) can render it without knowing the Cloudinary recipe.
    return NextResponse.json({
      ...product,
      images: product.images.map((image, index) => ({
        ...image,
        displayUrl: resolveImageUrl(image, index === 0),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
