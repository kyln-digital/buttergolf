import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteReference, isReferenceKind, updateReference } from "@/lib/admin-reference";
import { adminErrorResponse } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

type Params = { params: Promise<{ kind: string; id: string }> };

/**
 * PATCH  /api/admin/reference/{kind}/{id}   update (ADMIN)
 * DELETE /api/admin/reference/{kind}/{id}   delete when unused (ADMIN)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin(request, "reference.manage");
  if (guard.response) return guard.response;

  const { kind, id } = await params;
  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "Unknown reference kind" }, { status: 404 });
  }
  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await updateReference(kind, id, guard.admin.id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error, "Update failed");
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin(request, "reference.manage");
  if (guard.response) return guard.response;

  const { kind, id } = await params;
  if (!isReferenceKind(kind)) {
    return NextResponse.json({ error: "Unknown reference kind" }, { status: 404 });
  }

  try {
    const result = await deleteReference(kind, id, guard.admin.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error, "Delete failed");
  }
}
