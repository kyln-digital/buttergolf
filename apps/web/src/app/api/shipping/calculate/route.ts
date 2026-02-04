import { NextRequest, NextResponse } from "next/server";
import {
  calculateShippingRates,
  estimateShippingRate,
  ShippingCalculationRequest,
} from "@/lib/shipengine";

// POST /api/shipping/calculate - Calculate shipping rates for a product
export async function POST(request: NextRequest) {
  try {
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
