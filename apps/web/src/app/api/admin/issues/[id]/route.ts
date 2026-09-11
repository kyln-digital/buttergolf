import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { triageIssue } from "@/lib/admin-issues";
import { adminErrorResponse, optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * PATCH /api/admin/issues/[id]
 * Body: { status: "OPEN" | "UNDER_REVIEW", note?: string }
 * SUPPORT and ADMIN. Marks who is looking at it; no money moves.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request, "issues.triage");
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await readJsonObject(request)) ?? {};
  if (body.status !== "OPEN" && body.status !== "UNDER_REVIEW") {
    return NextResponse.json({ error: "status must be OPEN or UNDER_REVIEW" }, { status: 400 });
  }

  try {
    await triageIssue(id, {
      actorId: guard.admin.id,
      status: body.status,
      note: optionalString(body.note),
    });
    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    return adminErrorResponse(error, "Issue update failed");
  }
}
