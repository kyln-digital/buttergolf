import { NextRequest, NextResponse } from "next/server";
import { sweepStalePhoneUploads } from "@/lib/phone-upload-store";

// Vercel Cron: daily at 04:30 UTC (see vercel.json).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sweep-phone-uploads
 *
 * Removes phone-upload handoff rows two days or more old and destroys the
 * Cloudinary asset behind any that never became a product image, so photos a
 * seller sent from their phone but never collected don't stay billable.
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured - refusing to sweep phone uploads");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized cron request - invalid or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepStalePhoneUploads();
    console.info("Phone upload sweep complete:", result);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Phone upload sweep failed:", error);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
