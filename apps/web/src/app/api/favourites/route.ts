import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  logError,
  logWarning,
  FAV_FETCH_FAILED,
  FAV_USER_NOT_SYNCED,
  FAV_CREATE_FAILED,
  FAV_PRODUCT_NOT_FOUND,
  FAV_USER_UPSERT_FAILED,
} from "@buttergolf/constants";

// Force dynamic rendering to ensure Authorization headers pass through Vercel's edge
export const dynamic = "force-dynamic";

/**
 * GET /api/favourites
 * Fetch all products favourited by the authenticated user
 * Returns array of products with their details (images, category, seller info)
 * Supports both web (session cookies) and mobile (Bearer token) authentication
 */
export async function GET(req: NextRequest) {
  let clerkId: string | null = null;

  try {
    clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      // User not synced yet - this is expected behavior (Clerk webhook hasn't fired yet)
      logWarning("User not synced to database, returning empty favourites", {
        errorId: FAV_USER_NOT_SYNCED,
        clerkId,
      });

      return NextResponse.json({
        products: [],
        pagination: {
          page: 1,
          limit: 24,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Get pagination params
    const searchParams = req.nextUrl.searchParams;
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "24");
    const skip = (page - 1) * limit;

    // Fetch user's favourites with product details
    const [favourites, totalCount] = await Promise.all([
      prisma.favourite.findMany({
        where: { userId: user.id },
        include: {
          product: {
            include: {
              images: {
                take: 1,
                orderBy: { sortOrder: "asc" },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  averageRating: true,
                  ratingCount: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.favourite.count({
        where: { userId: user.id },
      }),
    ]);

    // Transform to product data format
    const products = favourites.map((fav) => ({
      id: fav.product.id,
      title: fav.product.title,
      description: fav.product.description,
      price: fav.product.price,
      condition: fav.product.condition,
      imageUrl: fav.product.images[0]?.url || null,
      category: fav.product.category?.name || "Uncategorized",
      seller: fav.product.user
        ? {
            id: fav.product.user.id,
            firstName: fav.product.user.firstName,
            lastName: fav.product.user.lastName,
            averageRating: fav.product.user.averageRating,
            ratingCount: fav.product.user.ratingCount,
          }
        : null,
      createdAt: fav.product.createdAt,
      favouritedAt: fav.createdAt,
    }));

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    // Log with context for debugging
    logError("Failed to fetch user favourites", error, {
      errorId: FAV_FETCH_FAILED,
      userId: clerkId,
      endpoint: "/api/favourites",
    });

    // Provide user-friendly error message
    return NextResponse.json(
      {
        error: "Failed to fetch favourites",
        message: "Unable to retrieve your favourites. Please try again later.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favourites
 * Add a product to the authenticated user's favourites
 * Body: { productId: string }
 * Supports both web (session cookies) and mobile (Bearer token) authentication
 */
export async function POST(req: NextRequest) {
  let clerkId: string | null = null;
  let productId: string | undefined;

  try {
    clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    productId = body.productId;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      logWarning("Attempt to favourite non-existent product", {
        errorId: FAV_PRODUCT_NOT_FOUND,
        clerkId,
        productId,
      });

      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Ensure user exists in database (create if webhook hasn't synced yet)
    let user;
    try {
      user = await prisma.user.upsert({
        where: { clerkId },
        update: {},
        create: {
          clerkId,
          email: `temp-${clerkId}@buttergolf.app`, // Temporary email, will be updated by webhook
          firstName: "User", // Placeholder, will be updated by webhook
          lastName: "",
        },
      });
    } catch (upsertError) {
      logError("Failed to upsert user during favourite creation", upsertError, {
        errorId: FAV_USER_UPSERT_FAILED,
        userId: clerkId,
        productId,
      });

      return NextResponse.json(
        {
          error: "Failed to create user record",
          message: "Please try again later.",
        },
        { status: 500 }
      );
    }

    // Create favourite (unique constraint prevents duplicates)
    try {
      const favourite = await prisma.favourite.create({
        data: {
          userId: user.id, // Use database User ID, not Clerk ID
          productId,
        },
      });

      return NextResponse.json(
        {
          success: true,
          favourite: {
            id: favourite.id,
            productId: favourite.productId,
            createdAt: favourite.createdAt,
          },
        },
        { status: 201 }
      );
    } catch (error: unknown) {
      // Handle duplicate favourite (unique constraint violation)
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        // This is expected behavior when user tries to favourite twice
        return NextResponse.json({ error: "Product already in favourites" }, { status: 409 });
      }

      // Log unexpected database errors
      logError("Failed to create favourite record", error, {
        errorId: FAV_CREATE_FAILED,
        userId: clerkId,
        productId,
      });

      throw error;
    }
  } catch (error) {
    // Catch-all for unexpected errors
    logError("Unexpected error while adding favourite", error, {
      errorId: FAV_CREATE_FAILED,
      userId: clerkId,
      productId,
      endpoint: "/api/favourites",
    });

    return NextResponse.json(
      {
        error: "Failed to add favourite",
        message: "Unable to add product to favourites. Please try again later.",
      },
      { status: 500 }
    );
  }
}
