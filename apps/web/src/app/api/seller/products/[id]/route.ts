import { NextRequest, NextResponse } from "next/server";
import { prisma, ProductCondition } from "@buttergolf/db";
import { LISTING_PRICE_LIMITS, getListingPriceBoundsMessage } from "@buttergolf/constants";
import { getUserIdFromRequest } from "@/lib/auth";
import { cloudinary, extractPublicId, isValidCloudinaryUrl } from "@/lib/cloudinary";

/**
 * PATCH /api/seller/products/[id]
 *
 * Updates a product owned by the authenticated user
 * Only allows updating: title, description, price, condition, brandId, model, categoryId, isSold
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(request);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const productId = resolvedParams.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify product exists and belongs to user
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (existingProduct.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - you can only edit your own products" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate allowed fields
    const allowedFields = [
      "title",
      "description",
      "price",
      "condition",
      "brandId",
      "model",
      "categoryId",
      "isSold",
    ];

    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validate condition if provided
    if (updateData.condition) {
      const validConditions: ProductCondition[] = [
        "NEW",
        "LIKE_NEW",
        "EXCELLENT",
        "GOOD",
        "FAIR",
        "POOR",
      ];
      if (!validConditions.includes(updateData.condition as ProductCondition)) {
        return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
      }
    }

    // Validate price if provided
    if (updateData.price !== undefined) {
      const price = Number(updateData.price);
      if (
        Number.isNaN(price) ||
        price < LISTING_PRICE_LIMITS.MIN ||
        price > LISTING_PRICE_LIMITS.MAX
      ) {
        return NextResponse.json({ error: getListingPriceBoundsMessage() }, { status: 400 });
      }
      updateData.price = price;
    }

    // Handle image mutations + product update in a single transaction.
    // images and removedImageIds are processed separately from allowedFields
    // because they require multi-step logic (delete, create, reorder) rather
    // than a direct Prisma data assignment.
    const MAX_IMAGE_IDS = 20; // safety cap

    // Collect URLs for Cloudinary cleanup after the transaction succeeds.
    // Cleanup must happen outside the transaction so images are only deleted
    // once the DB commit is confirmed (avoids deleting images on rollback).
    let urlsToCleanupAfterTx: string[] = [];

    const updatedProduct = await prisma.$transaction(async (tx) => {
      if (body.images || body.removedImageIds) {
        const existingImages = await tx.productImage.findMany({
          where: { productId },
          select: { id: true, url: true },
        });
        const existingUrlSet = new Set(existingImages.map((img) => img.url));
        const existingIdSet = new Set(existingImages.map((img) => img.id));

        // Delete removed images (capped to prevent abuse)
        const removedIds: string[] = Array.isArray(body.removedImageIds)
          ? body.removedImageIds
              .slice(0, MAX_IMAGE_IDS)
              .filter((id: unknown) => typeof id === "string" && existingIdSet.has(id as string))
          : [];

        if (removedIds.length > 0) {
          const toDelete = existingImages.filter((img) => removedIds.includes(img.id));
          urlsToCleanupAfterTx = toDelete.map((img) => img.url);
          await tx.productImage.deleteMany({
            where: { id: { in: removedIds }, productId },
          });
        }

        // Sync images: create new ones and update sort order
        if (Array.isArray(body.images)) {
          for (let i = 0; i < Math.min(body.images.length, MAX_IMAGE_IDS); i++) {
            const img = body.images[i];
            if (!img?.url || typeof img.url !== "string") continue;
            if (!isValidCloudinaryUrl(img.url)) continue;

            if (existingUrlSet.has(img.url)) {
              const existing = existingImages.find((e) => e.url === img.url);
              if (existing) {
                await tx.productImage.update({
                  where: { id: existing.id },
                  data: { sortOrder: i },
                });
              }
            } else {
              await tx.productImage.create({
                data: { url: img.url, sortOrder: i, productId },
              });
            }
          }
        }
      }

      return tx.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          category: true,
          brand: true,
        },
      });
    });

    // Best-effort Cloudinary cleanup after the DB transaction succeeds (fire-and-forget).
    // Done outside the transaction so images are only removed once the commit is confirmed.
    for (const cdnUrl of urlsToCleanupAfterTx) {
      const publicId = extractPublicId(cdnUrl);
      if (publicId) {
        cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

/**
 * DELETE /api/seller/products/[id]
 *
 * Deletes a product owned by the authenticated user
 * Only allows deletion if the product is not sold
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(request);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const productId = resolvedParams.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify product exists and belongs to user
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        orders: true,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (existingProduct.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - you can only delete your own products" },
        { status: 403 }
      );
    }

    // Prevent deletion if product has orders
    if (existingProduct.orders.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete product with existing orders" },
        { status: 400 }
      );
    }

    // Delete product (images will cascade delete)
    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
