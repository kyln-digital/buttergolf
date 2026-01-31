import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  logError,
  logWarning,
  FAV_DELETE_FAILED,
  AUTH_USER_NOT_FOUND,
} from "@buttergolf/constants";

// Force dynamic rendering to ensure Authorization headers pass through Vercel's edge
export const dynamic = "force-dynamic";

/**
 * DELETE /api/favourites/[productId]
 * Remove a product from the authenticated user's favourites
 * Supports both web (session cookies) and mobile (Bearer token) authentication
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  let clerkId: string | null = null;
  let productId: string | undefined;

  try {
    clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    productId = params.productId;

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      logWarning("User not found in database during favourite deletion", {
        errorId: AUTH_USER_NOT_FOUND,
        clerkId,
        productId,
      });

      return NextResponse.json(
        {
          error: "User not found",
          message: "Your account is not synced. Please try again later.",
        },
        { status: 404 }
      );
    }

    // Delete favourite using unique constraint
    try {
      await prisma.favourite.delete({
        where: {
          userId_productId: {
            userId: user.id,
            productId,
          },
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Product removed from favourites",
        },
        { status: 200 }
      );
    } catch (error: unknown) {
      // Handle case where favourite doesn't exist (P2025 = record not found)
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        // This is expected if user tries to unfavourite something that's not favourited
        return NextResponse.json({ error: "Favourite not found" }, { status: 404 });
      }

      // Log unexpected database errors
      logError("Failed to delete favourite record", error, {
        errorId: FAV_DELETE_FAILED,
        userId: clerkId,
        productId,
      });

      throw error;
    }
  } catch (error) {
    // Catch-all for unexpected errors
    logError("Unexpected error while removing favourite", error, {
      errorId: FAV_DELETE_FAILED,
      userId: clerkId,
      productId,
      endpoint: `/api/favourites/${productId}`,
    });

    return NextResponse.json(
      {
        error: "Failed to remove favourite",
        message: "Unable to remove product from favourites. Please try again later.",
      },
      { status: 500 }
    );
  }
}
