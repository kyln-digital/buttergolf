import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { OrdersList } from "./OrdersList";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch user's orders
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
    userRole: order.buyerId === user.id ? ("buyer" as const) : ("seller" as const),
  }));

  // Client component handles all UI rendering including layout
  return <OrdersList orders={ordersWithRole} />;
}
