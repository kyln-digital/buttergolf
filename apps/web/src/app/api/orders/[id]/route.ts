import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { getUserIdFromRequest } from "@/lib/auth";

// GET /api/orders/[id] - Get single order details
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params;

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            images: {
              orderBy: { sortOrder: "asc" },
            },
            category: true,
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
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check authorization - user must be either buyer or seller
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Add role information
    const orderWithRole = {
      ...order,
      userRole: order.buyerId === user.id ? "buyer" : "seller",
    };

    return NextResponse.json(orderWithRole);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
