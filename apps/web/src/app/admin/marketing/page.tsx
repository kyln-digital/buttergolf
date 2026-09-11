import { prisma } from "@buttergolf/db";
import { getAdminForPage } from "@/lib/admin-auth";
import { daysAgo } from "@/lib/admin-dates";
import { can } from "@/lib/admin-permissions";
import { MarketingView } from "./_components/MarketingView";

export const dynamic = "force-dynamic";

export default async function AdminMarketingPage() {
  const sevenDaysAgo = daysAgo(7);
  const [
    admin,
    waitlistTotal,
    waitlistWeek,
    newsletterTotal,
    newsletterWeek,
    waitlist,
    newsletter,
  ] = await Promise.all([
    getAdminForPage(),
    prisma.waitlist.count(),
    prisma.waitlist.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { subscribedAt: { gte: sevenDaysAgo } } }),
    prisma.waitlist.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, email: true, source: true, createdAt: true },
    }),
    prisma.newsletterSubscriber.findMany({
      orderBy: { subscribedAt: "desc" },
      take: 20,
      select: { id: true, email: true, source: true, subscribedAt: true },
    }),
  ]);

  return (
    <MarketingView
      stats={{ waitlistTotal, waitlistWeek, newsletterTotal, newsletterWeek }}
      waitlist={waitlist.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
      newsletter={newsletter.map((row) => ({
        id: row.id,
        email: row.email,
        source: row.source,
        createdAt: row.subscribedAt.toISOString(),
      }))}
      canExport={admin ? can(admin.role, "marketing.export") : false}
    />
  );
}
