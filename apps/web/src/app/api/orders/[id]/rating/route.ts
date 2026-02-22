import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * GET /api/orders/[id]/rating
 * Get the rating for an order (if exists)
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: orderId } = await params;

    // Get order to verify access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only buyer or seller can view rating
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get existing rating
    const rating = await prisma.sellerRating.findUnique({
      where: { orderId },
    });

    return NextResponse.json({
      rating,
      canRate: order.buyerId === user.id && order.status === "DELIVERED" && !rating,
    });
  } catch (error) {
    console.error("Error fetching rating:", error);
    return NextResponse.json({ error: "Failed to fetch rating" }, { status: 500 });
  }
}

/**
 * POST /api/orders/[id]/rating
 * Submit a rating for an order (buyers only, after delivery)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting: 5 ratings per hour
    const rateLimit = await checkRateLimit(user.id, {
      maxRequests: RATE_LIMITS.RATINGS_PER_HOUR,
      windowMs: 60 * 60 * 1000,
      keyFn: (userId) => `ratings:${userId}`,
    });

    if (rateLimit.isLimited) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const { id: orderId } = await params;
    const body = await req.json();
    const { rating, comment } = body;

    // Validate rating
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    // Validate comment
    if (comment && (typeof comment !== "string" || comment.length > 500)) {
      return NextResponse.json(
        { error: "Comment must be a string with max 500 characters" },
        { status: 400 }
      );
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only buyer can rate
    if (order.buyerId !== user.id) {
      return NextResponse.json({ error: "Only the buyer can rate this order" }, { status: 403 });
    }

    // Must be delivered
    if (order.status !== "DELIVERED") {
      return NextResponse.json({ error: "Can only rate after delivery" }, { status: 400 });
    }

    // Check for existing rating
    const existingRating = await prisma.sellerRating.findUnique({
      where: { orderId },
    });

    if (existingRating) {
      return NextResponse.json({ error: "Order has already been rated" }, { status: 400 });
    }

    // Create rating and update seller average in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create rating
      const newRating = await tx.sellerRating.create({
        data: {
          orderId,
          sellerId: order.sellerId,
          buyerId: user.id,
          rating,
          comment: comment?.trim() || null,
        },
      });

      // 2. Calculate new average (includes rating just created)
      const aggregation = await tx.sellerRating.aggregate({
        where: { sellerId: order.sellerId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      // 3. Update seller
      await tx.user.update({
        where: { id: order.sellerId },
        data: {
          ratingCount: aggregation._count.rating,
          averageRating: aggregation._avg.rating || 0,
        },
      });

      return newRating;
    });

    return NextResponse.json({
      success: true,
      rating: result,
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }
}
