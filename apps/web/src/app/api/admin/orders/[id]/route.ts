import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isShipmentStatus, overrideShipmentStatus } from "@/lib/admin-orders";
import { adminErrorResponse, optionalString } from "@/lib/admin-route-utils";
import { readJsonObject } from "@/lib/json-body";

/**
 * PATCH /api/admin/orders/[id]
 * Body: { shipmentStatus: ShipmentStatus, reason?: string }
 * ADMIN only. Manual shipment override with the webhook's side effects.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request, "orders.shipment");
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = (await readJsonObject(request)) ?? {};
  if (!isShipmentStatus(body.shipmentStatus)) {
    return NextResponse.json({ error: "Invalid shipment status" }, { status: 400 });
  }

  try {
    const order = await overrideShipmentStatus(id, {
      actorId: guard.admin.id,
      shipmentStatus: body.shipmentStatus,
      reason: optionalString(body.reason),
    });
    return NextResponse.json({
      ok: true,
      shipmentStatus: order.shipmentStatus,
      status: order.status,
      autoReleaseAt: order.autoReleaseAt,
    });
  } catch (error) {
    return adminErrorResponse(error, "Shipment override failed");
  }
}
