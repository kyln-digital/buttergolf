import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { refundOrder } from "@/lib/admin-orders";
import { adminErrorResponse, optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * POST /api/admin/orders/[id]/refund
 * Body: { amountPence?: number, reverseTransfer?: boolean, cancel?: boolean, reason?: string }
 * ADMIN only. Omit amountPence for a full refund.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request, "orders.refund");
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await readJsonObject(request)) ?? {};

  let amountPence: number | undefined;
  if (body.amountPence !== undefined && body.amountPence !== null) {
    if (typeof body.amountPence !== "number" || !Number.isInteger(body.amountPence)) {
      return NextResponse.json({ error: "amountPence must be a whole number" }, { status: 400 });
    }
    amountPence = body.amountPence;
  }

  try {
    const result = await refundOrder(id, {
      actorId: guard.admin.id,
      amountPence,
      reverseTransfer: body.reverseTransfer === true,
      cancel: body.cancel === true,
      reason: optionalString(body.reason),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error, "Refund failed");
  }
}
