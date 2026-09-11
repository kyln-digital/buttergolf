import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logError, UPLOAD_FAILED } from "@buttergolf/constants";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import {
  closePhoneUploadSession,
  isPhoneUploadSessionClosed,
  listCompletedPhoneUploads,
} from "@/lib/phone-upload-store";
import type { PhoneUploadPhoto } from "@/lib/phone-upload";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Answers per Clerk session; never cacheable.
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/upload/phone-session/[sessionId]
 *
 * Desktop, Clerk cookie. Lists every photo the phone has sent to one of the
 * caller's sessions. Returns the full list rather than a delta so a reload
 * (or a missed poll) loses nothing; the client dedupes by id. 410 once the
 * session has been closed, so a stale poller stops.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
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
  if (await isPhoneUploadSessionClosed(sessionId, userId)) {
    return NextResponse.json({ error: "Session closed" }, { status: 410 });
  }

  const photos: PhoneUploadPhoto[] = await listCompletedPhoneUploads(sessionId, userId);

  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * DELETE /api/upload/phone-session/[sessionId]
 *
 * Desktop, Clerk cookie. Closes a session the form has finished with
 * (published, saved, discarded, or replaced by a new code): further uploads
 * with its token are refused and any reservation in flight is dropped.
 * Idempotent.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  if (!UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const { isLimited, resetAt } = await checkRateLimit(userId, {
    maxRequests: 30,
    windowMs: 60_000,
    keyFn: (id) => `phone-session:close:${id}`,
  });
  if (isLimited) {
    return rateLimitResponse(resetAt);
  }

  try {
    // False for an id this seller never minted: nothing is written for it.
    const closed = await closePhoneUploadSession(sessionId, userId);
    return NextResponse.json({ closed });
  } catch (error) {
    logError("Failed to close phone upload session", error, {
      errorId: UPLOAD_FAILED,
      userId,
      sessionId,
    });
    return NextResponse.json({ error: "Couldn't close the session" }, { status: 500 });
  }
}
