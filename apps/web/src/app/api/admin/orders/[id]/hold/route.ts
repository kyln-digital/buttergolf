import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { setHoldStatus } from "@/lib/admin-orders";
import { adminErrorResponse, optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * POST /api/admin/orders/[id]/hold
 * Body: { freeze: boolean, reason?: string }
 * ADMIN only. Freeze parks the payout in DISPUTED; unfreeze returns it to HELD.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request, "orders.hold");
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await readJsonObject(request)) ?? {};
  if (typeof body.freeze !== "boolean") {
    return NextResponse.json({ error: "freeze must be true or false" }, { status: 400 });
  }

  try {
    const result = await setHoldStatus(id, {
      actorId: guard.admin.id,
      freeze: body.freeze,
      reason: optionalString(body.reason),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error, "Hold change failed");
  }
}
