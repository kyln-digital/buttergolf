import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * DELETE /api/images/[id]
 *
 * Deletes a product image by its database ID.
 * Verifies the image belongs to a product owned by the authenticated user.
 * Removes from both Cloudinary CDN and the database.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkId = await getUserIdFromRequest(request);
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const imageId = resolvedParams.id;

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch image with its product to verify ownership
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      include: { product: { select: { userId: true } } },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.product.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - you can only delete images from your own products" },
        { status: 403 }
      );
    }

    // Extract Cloudinary public ID from URL
    // URL: https://res.cloudinary.com/{cloud}/image/upload/v.../products/filename.ext
    const publicId = extractPublicId(image.url);

    // Delete from Cloudinary (best-effort — don't fail the request if CDN delete fails)
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Cloudinary destroy failed (non-blocking):", err);
      }
    }

    // Delete from database
    await prisma.productImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}

/**
 * Extracts the Cloudinary public_id from a secure_url.
 * e.g. "https://res.cloudinary.com/x/image/upload/v123/products/abc.jpg"
 *   → "products/abc"
 */
function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
