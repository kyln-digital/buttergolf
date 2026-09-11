import { notFound } from "next/navigation";
import { prisma } from "@buttergolf/db";
import { getAdminForPage } from "@/lib/admin-auth";
import { can, parseAdminUserIds } from "@/lib/admin-permissions";
import { clerkUserLink, stripeAccountLink } from "@/lib/stripe-links";
import { UserDetail } from "../_components/UserDetail";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [admin, user] = await Promise.all([
    getAdminForPage(),
    prisma.user.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        products: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            title: true,
            price: true,
            isSold: true,
            isDraft: true,
            hiddenAt: true,
            createdAt: true,
          },
        },
        ordersPurchased: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            amountTotal: true,
            status: true,
            paymentHoldStatus: true,
            createdAt: true,
            product: { select: { title: true } },
          },
        },
        ordersSold: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            amountTotal: true,
            status: true,
            paymentHoldStatus: true,
            createdAt: true,
            product: { select: { title: true } },
          },
        },
        issuesReported: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, orderId: true, reason: true, status: true, createdAt: true },
        },
        _count: {
          select: {
            products: true,
            ordersPurchased: true,
            ordersSold: true,
            buyerConversations: true,
            sellerConversations: true,
            ratingsReceived: true,
          },
        },
      },
    }),
  ]);

  if (!admin) notFound();
  if (!user) notFound();

  const auditTrail = await prisma.adminAction.findMany({
    where: { targetType: "user", targetId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  });

  const isBootstrapAdmin = parseAdminUserIds(process.env.ADMIN_USER_IDS).includes(user.clerkId);

  return (
    <UserDetail
      user={{
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        imageUrl: user.imageUrl,
        role: user.role,
        suspendedAt: user.suspendedAt?.toISOString() ?? null,
        suspendedReason: user.suspendedReason,
        isDeleted: user.isDeleted,
        createdAt: user.createdAt.toISOString(),
        averageRating: user.averageRating,
        ratingCount: user.ratingCount,
        stripeConnectId: user.stripeConnectId,
        stripeAccountStatus: user.stripeAccountStatus,
        stripeOnboardingComplete: user.stripeOnboardingComplete,
        stripeRequirementsDeadline: user.stripeRequirementsDeadline?.toISOString() ?? null,
        counts: user._count,
        isBootstrapAdmin,
      }}
      addresses={user.addresses.map((address) => ({
        id: address.id,
        name: address.name,
        line: [address.street1, address.street2, address.city, address.zip, address.country]
          .filter(Boolean)
          .join(", "),
        isDefault: address.isDefault,
      }))}
      listings={user.products.map((product) => ({
        ...product,
        hiddenAt: product.hiddenAt?.toISOString() ?? null,
        createdAt: product.createdAt.toISOString(),
      }))}
      purchases={user.ordersPurchased.map((order) => ({
        id: order.id,
        title: order.product.title,
        amountTotal: order.amountTotal,
        status: order.status,
        paymentHoldStatus: order.paymentHoldStatus,
        createdAt: order.createdAt.toISOString(),
      }))}
      sales={user.ordersSold.map((order) => ({
        id: order.id,
        title: order.product.title,
        amountTotal: order.amountTotal,
        status: order.status,
        paymentHoldStatus: order.paymentHoldStatus,
        createdAt: order.createdAt.toISOString(),
      }))}
      issues={user.issuesReported.map((issue) => ({
        ...issue,
        createdAt: issue.createdAt.toISOString(),
      }))}
      auditTrail={auditTrail.map((entry) => ({
        id: entry.id,
        action: entry.action,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt: entry.createdAt.toISOString(),
        actor: `${entry.actor.firstName} ${entry.actor.lastName}`.trim(),
      }))}
      links={{
        clerk: clerkUserLink(user.clerkId),
        stripe: stripeAccountLink(user.stripeConnectId),
      }}
      viewer={{
        id: admin.id,
        canSuspend: can(admin.role, "users.suspend"),
        canChangeRole: can(admin.role, "users.role"),
      }}
    />
  );
}
