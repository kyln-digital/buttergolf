import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma, ProductCondition } from "@buttergolf/db";
import { LISTING_PRICE_LIMITS, getListingPriceBoundsMessage } from "@buttergolf/constants";
import { getUserIdFromRequest } from "@/lib/auth";

// Map slider values to ProductCondition enum for backwards compatibility
function mapSlidersToConditionEnum(grip: number, head: number, shaft: number): ProductCondition {
  const avg = (grip + head + shaft) / 3;
  if (avg >= 9.5) return ProductCondition.LIKE_NEW;
  if (avg >= 8) return ProductCondition.EXCELLENT;
  if (avg >= 6) return ProductCondition.GOOD;
  if (avg >= 4) return ProductCondition.FAIR;
  if (avg >= 2) return ProductCondition.POOR;
  return ProductCondition.POOR;
}

export async function POST(request: Request) {
  try {
    // Authenticate user - supports both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(request);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create user from database
    // This ensures user exists even if webhook hasn't fired yet
    let user = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
      },
    });

    if (!user) {
      // Create user if not found (fallback for webhook delays)
      // In production, the webhook should handle this
      // We need to fetch the full user profile to get the name
      const clerkUser = await currentUser();

      if (!clerkUser) {
        return NextResponse.json({ error: "User not found" }, { status: 401 });
      }

      // Build user name from Clerk profile
      // Priority: firstName + lastName > username > email prefix
      let userFirstName = "";
      let userLastName = "";
      if (clerkUser.firstName) {
        userFirstName = clerkUser.firstName;
      }
      if (clerkUser.lastName) {
        userLastName = clerkUser.lastName;
      }
      // Fallback to username or email prefix for firstName
      if (!userFirstName && !userLastName) {
        if (clerkUser.username) {
          userFirstName = clerkUser.username;
        } else if (clerkUser.emailAddresses?.[0]?.emailAddress) {
          userFirstName = clerkUser.emailAddresses[0].emailAddress.split("@")[0];
        } else {
          userFirstName = "Golf Enthusiast";
        }
      }

      const createdUser = await prisma.user.create({
        data: {
          clerkId,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || `user-${clerkId}@temp.local`,
          firstName: userFirstName,
          lastName: userLastName,
          imageUrl: clerkUser.imageUrl || null,
        },
        select: {
          id: true,
        },
      });

      user = createdUser;
    }

    // No seller onboarding guard — users can list products without
    // completing Stripe Connect setup. Funds are held on the platform
    // until the seller completes payout setup in Account Settings.
    // See confirm-receipt/route.ts for the PENDING_SELLER_ONBOARDING flow.

    // Parse request body
    const body = await request.json();
    const {
      title,
      description,
      price,
      brandId,
      model,
      clubKind, // Optional: used for creating/updating ClubModel
      categoryId,
      images,
      // Golf club specific fields
      flex,
      loft,
      woodsSubcategory,
      headCoverIncluded,
      gripCondition,
      headCondition,
      shaftCondition,
      // Shipping dimensions
      length,
      width,
      height,
      weight,
      // Idempotency key to prevent duplicate submissions
      requestId,
      // Draft flag
      isDraft,
    } = body;

    // Defensive sanitisation: the client should send string URLs, but we occasionally
    // receive null/empty entries (e.g. interrupted cover-photo flow). Filter these out
    // so Prisma never receives invalid nested image records.
    const normalisedImages = Array.isArray(images)
      ? images
          .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object" && "url" in entry) {
              const urlValue = (entry as { url?: unknown }).url;
              return typeof urlValue === "string" ? urlValue.trim() : "";
            }
            return "";
          })
          .filter((url) => url.length > 0)
      : [];

    const normalisedCategoryId =
      typeof categoryId === "string" && categoryId.trim().length > 0 ? categoryId : null;

    // ============================================================
    // IDEMPOTENCY CHECK
    // Prevent duplicate product creation from double-submissions
    // ============================================================
    if (requestId) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          requestId,
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (existingProduct) {
        console.info(
          `[Products API] Duplicate request detected: ${requestId} - returning existing product ${existingProduct.id}`
        );
        // Return the existing product instead of creating a duplicate
        const product = await prisma.product.findUnique({
          where: { id: existingProduct.id },
          include: {
            images: true,
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
        return NextResponse.json(product, { status: 200 });
      }
    }

    let resolvedCategoryId = normalisedCategoryId;

    // Drafts can be saved from any partial state. Because Product.categoryId is required
    // in the schema, pick a stable fallback category when the user has not selected one yet.
    if (isDraft && !resolvedCategoryId) {
      const fallbackCategory =
        (await prisma.category.findFirst({
          where: { slug: "accessories" },
          select: { id: true },
        })) ??
        (await prisma.category.findFirst({
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }));

      if (!fallbackCategory) {
        return NextResponse.json(
          { error: "Unable to save draft: no categories are configured." },
          { status: 500 }
        );
      }

      resolvedCategoryId = fallbackCategory.id;
    }

    // Validate required fields for publish flow.
    if (!isDraft) {
      if (!title || !description || !price || !resolvedCategoryId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
    }

    const parsedPrice = Number(price) || 0;
    if (
      !isDraft &&
      (Number.isNaN(parsedPrice) ||
        parsedPrice < LISTING_PRICE_LIMITS.MIN ||
        parsedPrice > LISTING_PRICE_LIMITS.MAX)
    ) {
      return NextResponse.json({ error: getListingPriceBoundsMessage() }, { status: 400 });
    }

    if (!isDraft && normalisedImages.length === 0) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
    }

    // Validate slider ranges if provided
    if (gripCondition && (gripCondition < 1 || gripCondition > 10)) {
      return NextResponse.json(
        { error: "Grip condition must be between 1 and 10" },
        { status: 400 }
      );
    }
    if (headCondition && (headCondition < 1 || headCondition > 10)) {
      return NextResponse.json(
        { error: "Head condition must be between 1 and 10" },
        { status: 400 }
      );
    }
    if (shaftCondition && (shaftCondition < 1 || shaftCondition > 10)) {
      return NextResponse.json(
        { error: "Shaft condition must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Validate brandId exists if provided
    if (brandId) {
      const brandExists = await prisma.brand.findUnique({
        where: { id: brandId },
      });
      if (!brandExists) {
        return NextResponse.json({ error: "Invalid brandId" }, { status: 400 });
      }
    }

    // If model and brandId provided, create or update ClubModel record
    if (model && brandId && clubKind) {
      const existingModel = await prisma.clubModel.findUnique({
        where: {
          brandId_name_kind: {
            brandId,
            name: model,
            kind: clubKind,
          },
        },
      });

      if (existingModel) {
        // Increment usage count
        await prisma.clubModel.update({
          where: { id: existingModel.id },
          data: {
            usageCount: { increment: 1 },
            // Auto-verify after 3+ uses
            isVerified: existingModel.usageCount >= 2 ? true : existingModel.isVerified,
          },
        });
      } else {
        // Create new ClubModel
        await prisma.clubModel.create({
          data: {
            brandId,
            name: model,
            kind: clubKind,
            usageCount: 1,
            isVerified: false,
          },
        });
      }
    }

    if (!resolvedCategoryId) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    // Create product with images
    const product = await prisma.product.create({
      data: {
        title,
        description: description || "",
        price: parsedPrice,
        condition: mapSlidersToConditionEnum(
          gripCondition || 7,
          headCondition || 7,
          shaftCondition || 7
        ),
        brandId: brandId || null,
        model: model || null,
        userId: user.id,
        categoryId: resolvedCategoryId,
        // Golf club specific fields
        flex: flex || null,
        loft: loft || null,
        woodsSubcategory: woodsSubcategory || null,
        headCoverIncluded: headCoverIncluded || false,
        gripCondition: gripCondition || 7,
        headCondition: headCondition || 7,
        shaftCondition: shaftCondition || 7,
        // Shipping dimensions
        length: length ? Number(length) : null,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        // Idempotency key for duplicate prevention
        requestId: requestId || null,
        // Draft status
        isDraft: isDraft || false,
        images: {
          create: normalisedImages.map((url: string, index: number) => ({
            url,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: true,
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

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
