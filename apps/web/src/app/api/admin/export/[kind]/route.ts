import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { toCsv } from "@/lib/csv";

/**
 * GET /api/admin/export/waitlist | newsletter
 * ADMIN only. Streams the whole list as CSV. Logged, since it is personal data
 * leaving the system.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const guard = await requireAdmin(request, "marketing.export");
  if (guard.response) return guard.response;

  const { kind } = await params;
  let csv: string;
  let rowCount: number;

  if (kind === "waitlist") {
    const rows = await prisma.waitlist.findMany({ orderBy: { createdAt: "asc" } });
    rowCount = rows.length;
    csv = toCsv(
      ["email", "source", "signed_up_at"],
      rows.map((row) => [row.email, row.source, row.createdAt])
    );
  } else if (kind === "newsletter") {
    const rows = await prisma.newsletterSubscriber.findMany({ orderBy: { subscribedAt: "asc" } });
    rowCount = rows.length;
    csv = toCsv(
      ["email", "source", "subscribed_at"],
      rows.map((row) => [row.email, row.source, row.subscribedAt])
    );
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  await recordAdminAction(prisma, {
    actorId: guard.admin.id,
    action: "marketing.export",
    targetType: "user",
    targetId: guard.admin.id,
    metadata: { kind, rows: rowCount },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buttergolf-${kind}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
