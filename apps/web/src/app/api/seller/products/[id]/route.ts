import { NextRequest, NextResponse } from "next/server";
import { prisma, ProductCondition } from "@buttergolf/db";
import { LISTING_PRICE_LIMITS, getListingPriceBoundsMessage } from "@buttergolf/constants";
import { getUserIdFromRequest } from "@/lib/auth";
import { cloudinary, extractPublicId, isValidCloudinaryUrl } from "@/lib/cloudinary";
import { mapSlidersToConditionEnum } from "@/lib/product-condition";

/** Safety cap on how many image rows one request may touch. */
const MAX_IMAGE_IDS = 20;

/**
 * Thrown inside the update transaction when publishing would leave the listing
 * with no images, to roll it back. Distinguished from a genuine failure so the
 * caller still gets a 400 rather than a 500.
 */
class PublishWithoutImagesError extends Error {
  constructor() {
    super("At least one image is required");
    this.name = "PublishWithoutImagesError";
  }
}

const SLIDER_LABELS = {
  gripCondition: "Grip",
  headCondition: "Head",
  shaftCondition: "Shaft",
} as const;

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
      "isDraft",
      "flex",
      "loft",
      "woodsSubcategory",
      "headCoverIncluded",
      "gripCondition",
      "headCondition",
      "shaftCondition",
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

    // Validate the component sliders before anything derives from them.
    // Matches the range POST enforces; without it `gripCondition: 99` (or a
    // string) would persist and skew the derived condition.
    for (const field of ["gripCondition", "headCondition", "shaftCondition"] as const) {
      if (updateData[field] === undefined) continue;

      const value = updateData[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 10) {
        return NextResponse.json(
          { error: `${SLIDER_LABELS[field]} condition must be a number between 1 and 10` },
          { status: 400 }
        );
      }
    }

    // Keep the legacy `condition` enum in step with the component sliders. The
    // sell form only sends sliders, so without this an edited listing would
    // keep whatever condition it was first created with.
    if (updateData.condition === undefined) {
      const grip =
        (updateData.gripCondition as number | undefined) ?? existingProduct.gripCondition;
      const head =
        (updateData.headCondition as number | undefined) ?? existingProduct.headCondition;
      const shaft =
        (updateData.shaftCondition as number | undefined) ?? existingProduct.shaftCondition;

      const slidersChanged =
        updateData.gripCondition !== undefined ||
        updateData.headCondition !== undefined ||
        updateData.shaftCondition !== undefined;

      if (slidersChanged && grip != null && head != null && shaft != null) {
        updateData.condition = mapSlidersToConditionEnum(grip, head, shaft);
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

    // The image ids this request asks to delete, capped the same way the
    // transaction caps them. Derived here so the publish guard below and the
    // transaction agree on what is going away.
    const requestedRemovalIds: string[] = Array.isArray(body.removedImageIds)
      ? body.removedImageIds.slice(0, MAX_IMAGE_IDS).filter((id: unknown) => typeof id === "string")
      : [];

    // Publishing a draft (isDraft true → false) must satisfy the same minimums
    // as creating a listing outright, so the sell form's publish path can't
    // produce a live listing with no photo or no category.
    const isPublishing = existingProduct.isDraft && updateData.isDraft === false;

    // Publishing is one-way from this endpoint. The client serialises its own
    // writes, but that only orders what the *browser* sends: a request it timed
    // out on, or one already in flight when the seller hit publish, can still
    // reach us afterwards — and the sell form's autosave payload always carries
    // `isDraft: true`. Without this, a late autosave would quietly unpublish a
    // listing the seller had just made live.
    //
    // Nothing legitimately un-publishes through here; relisting a sold item
    // goes through `isSold`. Ignoring the field rather than erroring keeps the
    // stale autosave's other changes (which are harmless) from failing.
    if (!existingProduct.isDraft && updateData.isDraft === true) {
      delete updateData.isDraft;
    }

    if (isPublishing) {
      // Count what the product will actually be left with once the transaction
      // has run — not what the request happens to mention.
      //
      // When `images` is present it is the complete desired list, so count the
      // slice that will be persisted; counting the whole array would let a
      // request whose sole valid image sits past the cap publish with nothing
      // stored. When it's absent, count the stored rows minus the ones this
      // request is about to remove, or removing the last photo and publishing
      // in one call would slip through.
      const submittedImageCount = Array.isArray(body.images)
        ? body.images
            .slice(0, MAX_IMAGE_IDS)
            .filter(
              (img: unknown) =>
                typeof (img as { url?: unknown })?.url === "string" &&
                isValidCloudinaryUrl((img as { url: string }).url)
            ).length
        : await prisma.productImage.count({
            where: {
              productId,
              ...(requestedRemovalIds.length > 0 && { id: { notIn: requestedRemovalIds } }),
            },
          });

      if (submittedImageCount === 0) {
        return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
      }

      // Drafts are saved from any partial state, so publishing has to enforce
      // the same minimums POST does — against the effective row (this request
      // merged over what's already stored), not just the fields being sent.
      const effective = { ...existingProduct, ...updateData };

      const missing = (["title", "description", "categoryId"] as const).filter(
        (field) => typeof effective[field] !== "string" || effective[field].trim().length === 0
      );

      if (missing.length > 0) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const effectivePrice = Number(effective.price);
      if (
        !Number.isFinite(effectivePrice) ||
        effectivePrice < LISTING_PRICE_LIMITS.MIN ||
        effectivePrice > LISTING_PRICE_LIMITS.MAX
      ) {
        return NextResponse.json({ error: getListingPriceBoundsMessage() }, { status: 400 });
      }
    }

    // Handle image mutations + product update in a single transaction.
    // images and removedImageIds are processed separately from allowedFields
    // because they require multi-step logic (delete, create, reorder) rather
    // than a direct Prisma data assignment.

    // Collected inside the transaction, acted on only after it commits — see below.
    const urlsToCleanup: string[] = [];

    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Take a row lock on the product before touching its images. Anything
      // else that mutates this product's images (this route concurrently, or
      // DELETE /api/images/[id]) takes the same lock, so image removal and
      // publication can't interleave. Without it, the zero-image check below is
      // just a read: a concurrent delete could commit between the count and the
      // update and leave a published listing with no photos.
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;

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
          urlsToCleanup.push(...toDelete.map((img) => img.url));
          await tx.productImage.deleteMany({
            where: { id: { in: removedIds }, productId },
          });
        }

        // Sync images: create new ones and update sort order
        if (Array.isArray(body.images)) {
          const submittedUrls = new Set<string>();

          for (let i = 0; i < Math.min(body.images.length, MAX_IMAGE_IDS); i++) {
            const img = body.images[i];
            if (!img?.url || typeof img.url !== "string") continue;
            if (!isValidCloudinaryUrl(img.url)) continue;

            submittedUrls.add(img.url);

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

          // `images` is the complete desired list, so anything still in the DB
          // that wasn't submitted has been removed. The edit modal reports these
          // via removedImageIds, but the autosaved sell form has no image IDs to
          // report with — without this, deleting a photo mid-draft would leave
          // the row behind and it would reappear on publish.
          const stale = existingImages.filter(
            (img) => !submittedUrls.has(img.url) && !removedIds.includes(img.id)
          );

          if (stale.length > 0) {
            urlsToCleanup.push(...stale.map((img) => img.url));
            await tx.productImage.deleteMany({
              where: { id: { in: stale.map((img) => img.id) }, productId },
            });
          }
        }
      }

      // Re-assert the "published listings have a photo" rule inside the
      // transaction. The pre-flight check above gives the caller a clean 400,
      // but it reads before this transaction opens — a concurrent PATCH
      // removing the last image between the two would otherwise let this one
      // commit a published product with none. Throwing here rolls the whole
      // thing back.
      if (isPublishing) {
        const remainingImages = await tx.productImage.count({ where: { productId } });
        if (remainingImages === 0) {
          throw new PublishWithoutImagesError();
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

    // Cloudinary cleanup runs only once the transaction has committed. Doing it
    // inside would destroy assets that a later rollback leaves the DB still
    // pointing at, turning a failed edit into permanently broken images.
    // Best-effort: an orphaned asset is logged, never fails the request.
    for (const cdnUrl of urlsToCleanup) {
      const publicId = extractPublicId(cdnUrl);
      if (publicId) {
        cloudinary.uploader.destroy(publicId).catch((err) => {
          console.error("Failed to delete Cloudinary asset:", { publicId, err });
        });
      }
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    // Lost the race with a concurrent image removal — the transaction rolled
    // back, so the listing is untouched. Report it as the validation failure it
    // is rather than a server error.
    if (error instanceof PublishWithoutImagesError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
