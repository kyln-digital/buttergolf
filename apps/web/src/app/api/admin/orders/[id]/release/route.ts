import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { releaseOrderToSeller } from "@/lib/admin-orders";
import { adminErrorResponse, optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * POST /api/admin/orders/[id]/release
 * Body: { reason?: string }
 * ADMIN only. Pays the seller now (or parks the order on onboarding).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request, "orders.release");
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await readJsonObject(request)) ?? {};

  try {
    const result = await releaseOrderToSeller(id, {
      actorId: guard.admin.id,
      reason: optionalString(body.reason),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error, "Release failed");
  }
}
