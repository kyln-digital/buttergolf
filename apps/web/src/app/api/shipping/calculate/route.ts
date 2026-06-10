import { NextRequest, NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/middleware/rate-limit";
import {
  calculateShippingRates,
  estimateShippingRate,
  ShippingCalculationRequest,
} from "@/lib/shipengine";

// Each call hits the paid ShipEngine API, so unauthenticated traffic must be throttled.
const RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 };

// POST /api/shipping/calculate - Calculate shipping rates for a product
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceIpRateLimit(request, "shipping-calculate", RATE_LIMIT);
    if (limited) return limited;

    const body: ShippingCalculationRequest = await request.json();
    const result = await calculateShippingRates(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error calculating shipping rates:", error);
    const raw = error instanceof Error ? error.message : "";
    // Surface only known client-actionable errors; mask everything else.
    if (raw === "Product not found") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (raw.includes("Missing required")) {
      return NextResponse.json({ error: "Missing required shipping details" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to calculate shipping rates" }, { status: 500 });
  }
}

// GET /api/shipping/calculate?productId=xxx&postcode=SW1A1AA - Quick rate estimate (for product pages)
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceIpRateLimit(request, "shipping-calculate", RATE_LIMIT);
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
    const raw = error instanceof Error ? error.message : "";
    if (raw === "Product not found") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to estimate shipping rate" }, { status: 500 });
  }
}
