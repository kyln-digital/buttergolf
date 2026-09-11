import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";
import {
  LISTING_PRICE_LIMITS,
  getListingPriceBoundsMessage,
  getParcelPreset,
  validateParcel,
  type ParcelDimensions,
} from "@buttergolf/constants";
import { getUserIdFromRequest } from "@/lib/auth";
import { validateUKAddress, type ShippingAddress } from "@/lib/address-validation";
import { mapSlidersToConditionEnum } from "@/lib/product-condition";
import { ensureConnectAccountInBackground, getTosEvidenceFromRequest } from "@/lib/stripe-connect";

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
      parcelPresetId,
      length,
      width,
      height,
      weight,
      // Idempotency key to prevent duplicate submissions
      requestId,
      // Draft flag
      isDraft,
      // The client confirms it showed the seller-terms consent line (which
      // incorporates the Stripe Connected Account Agreement) next to publish.
      acceptsSellerTerms,
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

    const parsedPrice = Math.max(0, Number(price) || 0);
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

    // ============================================================
    // SHIPPING READINESS (published listings only)
    // A listing that can't be posted is worse than no listing: the buyer pays,
    // the label fails, and we're refunding a sale that should never have been
    // possible. Both gates below are the cheapest place to catch that.
    // ============================================================
    let resolvedParcel: ParcelDimensions | null = null;

    if (!isDraft) {
      // Gate 1: the seller must have somewhere to post from. Without this,
      // order creation invents an "Address pending" placeholder and label
      // generation fails after the buyer has already been charged.
      const sellerAddress = await prisma.address.findFirst({
        where: { userId: user.id, isDefault: true },
      });

      // Run the same validation label purchase will run. Checking only for a
      // missing row let a half-filled address through, and it then failed at
      // label time — after the buyer had paid, which is the failure this gate
      // exists to prevent.
      // Validate the address the way label purchase will, so a listing can't
      // pass here and then fail after the buyer has paid. validateSellerCanShip
      // is worded for buyers ("this seller hasn't...") and names no field, so
      // go to the field-level validator and tell the seller what to fix.
      if (!sellerAddress) {
        return NextResponse.json(
          {
            error: "Add your postage address before publishing a listing",
            code: "SELLER_ADDRESS_REQUIRED",
          },
          { status: 400 }
        );
      }

      const addressCheck = validateUKAddress(sellerAddress as ShippingAddress, { isSeller: true });
      if (!addressCheck.isValid) {
        return NextResponse.json(
          {
            error: `Your postage address needs fixing before you can publish: ${addressCheck.errors[0].message}`,
            code: "SELLER_ADDRESS_REQUIRED",
            errors: addressCheck.errors,
          },
          { status: 400 }
        );
      }

      // Gate 2: the parcel has to be postable. Prefer the seller's own numbers,
      // fall back to the preset they picked, then to the category default.
      const preset = getParcelPreset(parcelPresetId);
      resolvedParcel = {
        length: Number(length) || preset?.length || 0,
        width: Number(width) || preset?.width || 0,
        height: Number(height) || preset?.height || 0,
        weight: Number(weight) || preset?.weight || 0,
      };

      const parcelErrors = validateParcel(resolvedParcel);
      if (parcelErrors.length > 0) {
        return NextResponse.json(
          {
            error: parcelErrors[0].message,
            code: "PARCEL_INVALID",
            errors: parcelErrors,
          },
          { status: 400 }
        );
      }
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

    if (!resolvedCategoryId) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    // Wrap ClubModel upsert + Product creation in a transaction so a failure
    // in one doesn't leave the other in an inconsistent state.
    const product = await prisma.$transaction(async (tx) => {
      // If model and brandId provided, create or update ClubModel record
      if (model && brandId && clubKind) {
        const existingModel = await tx.clubModel.findUnique({
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
          await tx.clubModel.update({
            where: { id: existingModel.id },
            data: {
              usageCount: { increment: 1 },
              // Auto-verify after 3+ uses (usageCount is pre-increment, so >= 2 means this is the 3rd use)
              isVerified: existingModel.usageCount >= 2 ? true : existingModel.isVerified,
            },
          });
        } else {
          // Create new ClubModel
          await tx.clubModel.create({
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

      // Create product with images
      return tx.product.create({
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
          // Shipping dimensions. Published listings store the validated parcel
          // so rating and label purchase never fall back to invented defaults.
          parcelPresetId: parcelPresetId || null,
          length: resolvedParcel?.length ?? (length ? Number(length) : null),
          width: resolvedParcel?.width ?? (width ? Number(width) : null),
          height: resolvedParcel?.height ?? (height ? Number(height) : null),
          weight: resolvedParcel?.weight ?? (weight ? Number(weight) : null),
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
    });

    // Publishing is the moment the seller becomes someone we will owe money
    // to, so create their connected account now — recording their acceptance
    // of our terms (which incorporate the Stripe Connected Account Agreement)
    // from this very request. Fire-and-forget: a failure here just means the
    // account is created later, when they open payout setup.
    if (!product.isDraft) {
      ensureConnectAccountInBackground({
        userId: user.id,
        // Only record acceptance when the client says the consent copy was
        // shown; otherwise the account is created with tos_acceptance due
        // and the payout details step (which always shows it) collects it.
        tos: acceptsSellerTerms === true ? getTosEvidenceFromRequest(request) : undefined,
      });
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
