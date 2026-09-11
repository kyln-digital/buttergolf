import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";
import { logError, UPLOAD_FAILED } from "@buttergolf/constants";
import { checkRateLimit, rateLimitResponse } from "@/middleware/rate-limit";
import {
  clampPhoneUploadMax,
  createPhoneUploadSessionToken,
  readBearerToken,
  verifyPhoneUploadSessionToken,
} from "@/lib/phone-upload-session";
import type { PhoneUploadSessionCreated, PhoneUploadSessionStatus } from "@/lib/phone-upload";

/**
 * Sessions live fifteen minutes, so a row a day old belongs to a session
 * nobody is polling. Swept whenever the same seller starts a new one, which
 * keeps the table bounded without a dedicated cron.
 */
const STALE_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/upload/phone-session
 *
 * Desktop, Clerk cookie. Mints the token the sell form shows as a QR code.
 * Body: `{ maxPhotos?: number }` — how many slots the form has left.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isLimited, resetAt } = await checkRateLimit(userId, {
    maxRequests: 20,
    windowMs: 60_000,
    keyFn: (id) => `phone-session:create:${id}`,
  });
  if (isLimited) {
    return rateLimitResponse(resetAt);
  }

  let requestedMax: unknown;
  try {
    const body = (await request.json()) as { maxPhotos?: unknown } | null;
    requestedMax = body?.maxPhotos;
  } catch {
    // No body, or not JSON — fall back to the ceiling.
  }

  try {
    const { token, session } = await createPhoneUploadSessionToken(
      userId,
      clampPhoneUploadMax(requestedMax)
    );

    // Best effort: a failed sweep must not stop the seller getting a code.
    prisma.phoneUpload
      .deleteMany({
        where: { clerkId: userId, createdAt: { lt: new Date(Date.now() - STALE_UPLOAD_AGE_MS) } },
      })
      .catch((sweepError: unknown) => {
        logError("Failed to sweep stale phone uploads", sweepError, {
          errorId: UPLOAD_FAILED,
          userId,
        });
      });

    const payload: PhoneUploadSessionCreated = {
      sessionId: session.sessionId,
      token,
      expiresAt: session.expiresAt,
      maxPhotos: session.maxPhotos,
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("Failed to create phone upload session", error, {
      errorId: UPLOAD_FAILED,
      userId,
    });
    return NextResponse.json(
      { error: "Couldn't create a QR code right now. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/phone-session
 *
 * Phone, Bearer token from the QR code. Describes the session the token grants
 * so the page can show progress, including after a reload.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = readBearerToken(request);
  const session = token ? await verifyPhoneUploadSessionToken(token) : null;

  if (!session) {
    return NextResponse.json(
      { error: "This link has expired. Scan a fresh QR code from your computer." },
      { status: 401 }
    );
  }

  const photos = await prisma.phoneUpload.findMany({
    where: { sessionId: session.sessionId, clerkId: session.clerkId },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true },
  });

  const payload: PhoneUploadSessionStatus = {
    sessionId: session.sessionId,
    maxPhotos: session.maxPhotos,
    expiresAt: session.expiresAt,
    photos,
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
