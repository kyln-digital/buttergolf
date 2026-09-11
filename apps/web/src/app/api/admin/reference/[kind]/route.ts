import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createReference, isReferenceKind } from "@/lib/admin-reference";
import { adminErrorResponse } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * GET  /api/admin/reference/{brands|categories|club-models}   list (SUPPORT+)
 * POST /api/admin/reference/{brands|categories|club-models}   create (ADMIN)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const guard = await requireAdmin(request, "listings.view");
  if (guard.response) return guard.response;

  const { kind } = await params;
  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "Unknown reference kind" }, { status: 404 });
  }

  if (kind === "brands") {
    return NextResponse.json({
      items: await prisma.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    });
  }
  if (kind === "categories") {
    return NextResponse.json({
      items: await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim();
  return NextResponse.json({
    items: await prisma.clubModel.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      take: 200,
      include: { brand: { select: { id: true, name: true } } },
    }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const guard = await requireAdmin(request, "reference.manage");
  if (guard.response) return guard.response;

  const { kind } = await params;
  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "Unknown reference kind" }, { status: 404 });
  }
  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await createReference(kind, guard.admin.id, body);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error, "Create failed");
  }
}
