import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import {
  calculateShippingRates,
  estimateShippingRate,
  ShippingCalculationRequest,
} from "@/lib/shipengine";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

// Each call hits the paid ShipEngine API, so unauthenticated traffic must be throttled.
async function enforceRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const clientIp = getClientIp(request);
  const { isLimited, resetAt, headers } = await checkRateLimit(clientIp, {
    maxRequests: 20,
    windowMs: 60_000,
    keyFn: (ip) => `shipping-calculate:${ip}`,
  });
  if (isLimited) {
    const response = rateLimitResponse(resetAt);
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
  return null;
}

// POST /api/shipping/calculate - Calculate shipping rates for a product
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request);
    if (limited) return limited;

    const body: ShippingCalculationRequest = await request.json();
    const result = await calculateShippingRates(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error calculating shipping rates:", error);
    const message = error instanceof Error ? error.message : "Failed to calculate shipping rates";
    const status =
      message === "Product not found" ? 404 : message.includes("Missing required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// GET /api/shipping/calculate?productId=xxx&postcode=SW1A1AA - Quick rate estimate (for product pages)
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request);
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const postcode = searchParams.get("postcode") || searchParams.get("zip"); // Support both UK and legacy param
    const county = searchParams.get("county") || searchParams.get("state") || ""; // Support both UK and legacy param

    if (!productId || !postcode) {
      return NextResponse.json({ error: "productId and postcode are required" }, { status: 400 });
    }

    const result = await estimateShippingRate(productId, postcode, county);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error estimating shipping rate:", error);
    const message = error instanceof Error ? error.message : "Failed to estimate shipping rate";
    const status = message === "Product not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
