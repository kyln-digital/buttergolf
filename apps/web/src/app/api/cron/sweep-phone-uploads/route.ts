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
    // Keep taking batches while there is budget and the last one was full, so
    // a backlog larger than one batch still drains within a run or two rather
    // than growing without bound. Leaves headroom before maxDuration for the
    // batch in progress.
    const startedAt = Date.now();
    const BUDGET_MS = 40_000;
    const BATCH = 50;
    const result = { deleted: 0, destroyed: 0, batches: 0 };
    for (;;) {
      const batch = await sweepStalePhoneUploads(BATCH);
      result.deleted += batch.deleted;
      result.destroyed += batch.destroyed;
      result.batches += 1;
      const exhausted = batch.deleted === 0 || batch.deleted < BATCH;
      if (exhausted || Date.now() - startedAt > BUDGET_MS) break;
    }
    console.info("Phone upload sweep complete:", result);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Phone upload sweep failed:", error);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
