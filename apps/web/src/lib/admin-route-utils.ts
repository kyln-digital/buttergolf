import { NextResponse } from "next/server";
import { AdminOrderError } from "@/lib/admin-orders";

/**
 * Turn whatever an admin action threw into a response staff can act on.
 * AdminOrderError carries its own status and a human message; Stripe errors
 * are surfaced verbatim (they are written for operators); anything else is
 * a 500 with no detail.
 */
export function adminErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof AdminOrderError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type?: unknown }).type === "string" &&
    (error as { type: string }).type.startsWith("Stripe")
  ) {
    const message = error instanceof Error ? error.message : "Stripe request failed";
    console.error(`${fallback} (Stripe):`, error);
    return NextResponse.json({ error: `Stripe: ${message}` }, { status: 502 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function optionalString(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}
