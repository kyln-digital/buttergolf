import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { OrdersList } from "./OrdersList";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in?redirect_url=%2Forders");
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    redirect("/sign-in?redirect_url=%2Forders");
  }

  // Fetch user's orders. Counterparty email is intentionally not selected -
  // buyers and sellers must not receive each other's email addresses.
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    },
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
          imageUrl: true,
        },
      },
      buyer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
        },
      },
      fromAddress: true,
      toAddress: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Add role information to each order
  const ordersWithRole = orders.map((order) => ({
    ...order,
    userRole: order.buyerId === user.id ? ("buyer" as const) : ("seller" as const),
  }));

  // Client component handles all UI rendering including layout
  return <OrdersList orders={ordersWithRole} />;
}
