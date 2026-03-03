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

    // Handle image mutations if provided
    if (body.images || body.removedImageIds) {
      const existingImages = await prisma.productImage.findMany({
        where: { productId },
        select: { id: true, url: true },
      });
      const existingUrlSet = new Set(existingImages.map((img: { url: string }) => img.url));
      const existingIdSet = new Set(existingImages.map((img: { id: string }) => img.id));

      // Delete removed images
      const removedIds: string[] = Array.isArray(body.removedImageIds)
        ? body.removedImageIds.filter(
            (id: unknown) => typeof id === "string" && existingIdSet.has(id as string)
          )
        : [];

      if (removedIds.length > 0) {
        // Get URLs for Cloudinary cleanup
        const toDelete = existingImages.filter((img: { id: string }) =>
          removedIds.includes(img.id)
        );
        await prisma.productImage.deleteMany({
          where: { id: { in: removedIds }, productId },
        });

        // Best-effort Cloudinary cleanup (don't block on failure)
        for (const img of toDelete) {
          const publicId = extractPublicId(img.url);
          if (publicId) {
            cloudinary.uploader.destroy(publicId).catch(() => {});
          }
        }
      }

      // Sync images: create new ones and update sort order
      if (Array.isArray(body.images)) {
        const imageOps = [];
        for (let i = 0; i < body.images.length; i++) {
          const img = body.images[i];
          if (!img?.url || typeof img.url !== "string") continue;

          if (!isValidCloudinaryUrl(img.url)) continue;

          if (existingUrlSet.has(img.url)) {
            // Existing image — update sort order
            const existing = existingImages.find((e: { url: string }) => e.url === img.url);
            if (existing) {
              imageOps.push(
                prisma.productImage.update({
                  where: { id: existing.id },
                  data: { sortOrder: i },
                })
              );
            }
          } else {
            // New image — create record
            imageOps.push(
              prisma.productImage.create({
                data: {
                  url: img.url,
                  sortOrder: i,
                  productId,
                },
              })
            );
          }
        }
        if (imageOps.length > 0) {
          await prisma.$transaction(imageOps);
        }
      }
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
        category: true,
        brand: true,
      },
    });

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
