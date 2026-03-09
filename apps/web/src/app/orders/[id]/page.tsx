import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { OrderDetail } from "./OrderDetail";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const redirectUrl = `/sign-in?redirect_url=${encodeURIComponent(`/orders/${id}`)}`;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect(redirectUrl);
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    redirect(redirectUrl);
  }

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
          brand: true,
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
    redirect("/orders");
  }

  // Check authorization
  if (order.buyerId !== user.id && order.sellerId !== user.id) {
    redirect("/orders");
  }

  // Add role information
  const orderWithRole = {
    ...order,
    userRole: order.buyerId === user.id ? ("buyer" as const) : ("seller" as const),
    currentUserId: user.id,
    product: {
      ...order.product,
      brand: order.product.brand?.name || null,
    },
  };

  // Client component handles all UI rendering
  return <OrderDetail order={orderWithRole} />;
}
