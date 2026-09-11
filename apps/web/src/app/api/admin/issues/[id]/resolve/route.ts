import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isIssueResolution, resolveIssue } from "@/lib/admin-issues";
import { adminErrorResponse, optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * POST /api/admin/issues/[id]/resolve
 * Body: { resolution: "REFUNDED" | "RELEASED" | "DISMISSED", note?: string, reverseTransfer?: boolean }
 * ADMIN only. Moves the money (or not), closes the issue, emails both sides.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request, "issues.resolve");
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await readJsonObject(request)) ?? {};
  if (!isIssueResolution(body.resolution)) {
    return NextResponse.json(
      { error: "resolution must be REFUNDED, RELEASED or DISMISSED" },
      { status: 400 }
    );
  }

  try {
    const result = await resolveIssue(id, {
      actorId: guard.admin.id,
      resolution: body.resolution,
      note: optionalString(body.note, 2000),
      reverseTransfer: body.reverseTransfer === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error, "Resolving the issue failed");
  }
}
