import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import { listCompletedPhoneUploads } from "@/lib/phone-upload-store";
import type { PhoneUploadPhoto } from "@/lib/phone-upload";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/upload/phone-session/[sessionId]
 *
 * Desktop, Clerk cookie. Lists every photo the phone has sent to one of the
 * caller's sessions. Returns the full list rather than a delta so a reload
 * (or a missed poll) loses nothing; the client dedupes by id.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  if (!UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  // Polled every couple of seconds per open sell form; leave headroom for two.
  const { isLimited, resetAt } = await checkRateLimit(userId, {
    maxRequests: 120,
    windowMs: 60_000,
    keyFn: (id) => `phone-session:poll:${id}`,
  });
  if (isLimited) {
    return rateLimitResponse(resetAt);
  }

  // Filtering by clerkId is the ownership check: rows only ever carry the id
  // baked into the token that produced them.
  const photos: PhoneUploadPhoto[] = await listCompletedPhoneUploads(sessionId, userId);

  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}
