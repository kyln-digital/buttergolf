import { NextResponse } from "next/server";
import { prisma, Prisma, OrderStatus } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

// GET /api/orders - List user's orders (as buyer or seller)
export async function GET(req: Request) {
  try {
    // Support both web cookies and mobile Bearer tokens
    const clerkId = await getUserIdFromRequest(req);

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role"); // 'buyer' | 'seller' | 'all'
    const status = searchParams.get("status") as OrderStatus | null; // Filter by status

    // Build where clause based on query parameters
    const whereClause: Prisma.OrderWhereInput = {};

    if (role === "buyer") {
      whereClause.buyerId = user.id;
    } else if (role === "seller") {
      whereClause.sellerId = user.id;
    } else {
      // Both buyer and seller orders
      whereClause.OR = [{ buyerId: user.id }, { sellerId: user.id }];
    }

    if (status) {
      whereClause.status = status;
    }

    // Fetch orders
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            images: {
              orderBy: { sortOrder: "asc" },
              take: 1,
            },
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
          },
        },
        fromAddress: true,
        toAddress: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Add role information to each order
    const ordersWithRole = orders.map((order) => ({
      ...order,
      userRole: order.buyerId === user.id ? "buyer" : "seller",
    }));

    return NextResponse.json(ordersWithRole);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
