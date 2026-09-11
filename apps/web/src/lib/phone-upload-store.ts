import { prisma } from "@buttergolf/db";
import { logError, UPLOAD_FAILED } from "@buttergolf/constants";
import { cloudinary, extractPublicId } from "./cloudinary";
import type { PhoneUploadSession } from "./phone-upload-session";

/**
 * Persistence for the phone-to-desktop photo handoff.
 *
 * A session's allowance is enforced by *reserving* a row before the billable
 * Cloudinary upload, not by counting afterwards: concurrent uploads carrying
 * the same token queue on a per-session advisory lock, so only as many as the
 * allowance permits ever reach Cloudinary. A reservation is a row whose `url`
 * is still empty; it is filled in when the upload succeeds and deleted when it
 * fails. Readers only ever see filled rows.
 *
 * Two sentinel `url` values share the table so no schema change is needed:
 * `""` for a reservation in flight and `"closed"` for a session the desktop
 * has finished with. Neither is ever returned to a reader.
 */

/** Marks a reserved slot whose upload hasn't finished. */
const PENDING_URL = "";

/**
 * Marks a session the desktop has finished with (published, saved, discarded
 * or replaced by a new code). Uploads against it are refused, so a phone left
 * on the page can't keep filling Cloudinary with photos nobody will collect.
 */
const CLOSED_URL = "closed";

const SENTINEL_URLS = [PENDING_URL, CLOSED_URL];

/**
 * A reservation older than this belongs to a request that died mid-upload.
 * The upload route caps its own run time at sixty seconds (`maxDuration`),
 * so a reservation five minutes old cannot still be in flight; treating it as
 * free means a crash can't hold a slot hostage for the rest of the session
 * without ever reclaiming one from a slow but live upload.
 */
const PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Rows older than this belong to sessions nobody can be polling any more:
 * tokens last fifteen minutes and the desktop honours a restore for a day.
 */
export const STALE_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;

export type ReservePhoneUploadOutcome =
  | { kind: "reserved"; id: string }
  | { kind: "over-cap" }
  | { kind: "closed" };

/**
 * Takes one slot of the session's allowance, atomically. Returns `over-cap`
 * when the allowance is used up, counting slots still reserved by in-flight
 * uploads, and `closed` once the desktop has finished with the session. The
 * lock is transaction-scoped, which also keeps it safe behind Neon's
 * connection pooler.
 */
export async function reservePhoneUploadSlot(
  session: PhoneUploadSession
): Promise<ReservePhoneUploadOutcome> {
  const { sessionId, clerkId, maxPhotos } = session;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}::text))`;

    const closed = await tx.phoneUpload.findFirst({
      where: { sessionId, clerkId, url: CLOSED_URL },
      select: { id: true },
    });
    if (closed) {
      return { kind: "closed" };
    }

    await tx.phoneUpload.deleteMany({
      where: {
        sessionId,
        clerkId,
        url: PENDING_URL,
        createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) },
      },
    });

    const taken = await tx.phoneUpload.count({
      where: { sessionId, clerkId, url: { not: CLOSED_URL } },
    });
    if (taken >= maxPhotos) {
      return { kind: "over-cap" };
    }

    const row = await tx.phoneUpload.create({
      data: { sessionId, clerkId, url: PENDING_URL },
      select: { id: true },
    });
    return { kind: "reserved", id: row.id };
  });
}

/** Fills a reserved slot with the uploaded asset, making it visible to the desktop. */
export async function completePhoneUpload(reservationId: string, url: string): Promise<void> {
  await prisma.phoneUpload.update({ where: { id: reservationId }, data: { url } });
}

/**
 * Gives a reserved slot back after a failed upload. Never throws: the phone is
 * already getting an error, and a slot that leaks here is reclaimed by the
 * pending TTL anyway. Callers should still await it, since a serverless
 * function may be frozen as soon as its response is sent.
 */
export async function releasePhoneUploadSlot(reservationId: string): Promise<void> {
  try {
    await prisma.phoneUpload.delete({ where: { id: reservationId } });
  } catch (error) {
    logError("Failed to release phone upload slot", error, {
      errorId: UPLOAD_FAILED,
      reservationId,
    });
  }
}

/** Photos the phone has finished sending for a session, oldest first. */
export async function listCompletedPhoneUploads(
  sessionId: string,
  clerkId: string
): Promise<Array<{ id: string; url: string }>> {
  return prisma.phoneUpload.findMany({
    where: { sessionId, clerkId, url: { notIn: SENTINEL_URLS } },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true },
  });
}

/** Whether the desktop has finished with a session. */
export async function isPhoneUploadSessionClosed(
  sessionId: string,
  clerkId: string
): Promise<boolean> {
  const closed = await prisma.phoneUpload.findFirst({
    where: { sessionId, clerkId, url: CLOSED_URL },
    select: { id: true },
  });
  return closed !== null;
}

/**
 * Marks a session finished and drops any reservation still in flight, so a
 * phone left on the page gets a clear refusal instead of uploading photos
 * nobody will collect. Completed rows are left alone: the desktop may still
 * be holding their photos in an unsaved form, and the daily sweep reclaims
 * any that never become product images.
 */
export async function closePhoneUploadSession(sessionId: string, clerkId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}::text))`;

    const closed = await tx.phoneUpload.findFirst({
      where: { sessionId, clerkId, url: CLOSED_URL },
      select: { id: true },
    });
    if (!closed) {
      await tx.phoneUpload.create({ data: { sessionId, clerkId, url: CLOSED_URL } });
    }

    await tx.phoneUpload.deleteMany({ where: { sessionId, clerkId, url: PENDING_URL } });
  });
}

export interface SweepPhoneUploadsResult {
  /** Handoff rows removed. */
  deleted: number;
  /** Cloudinary assets destroyed because no product image references them. */
  destroyed: number;
}

/**
 * Removes handoff rows older than {@link STALE_UPLOAD_AGE_MS}, destroying the
 * Cloudinary asset behind any whose URL never made it into a product image.
 * A phone photo the desktop placed becomes a `ProductImage` on the listing's
 * autosaved draft within seconds, so anything still unreferenced a day later
 * was never collected (or was removed again) and would otherwise stay billable
 * for good. Run daily by the `sweep-phone-uploads` cron; bounded per run so
 * it stays inside the function's time budget.
 */
export async function sweepStalePhoneUploads(limit = 200): Promise<SweepPhoneUploadsResult> {
  const stale = await prisma.phoneUpload.findMany({
    where: { createdAt: { lt: new Date(Date.now() - STALE_UPLOAD_AGE_MS) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, url: true },
  });

  if (stale.length === 0) {
    return { deleted: 0, destroyed: 0 };
  }

  const candidateUrls = Array.from(
    new Set(stale.map((row) => row.url).filter((url) => !SENTINEL_URLS.includes(url)))
  );

  const referenced = new Set(
    (
      await prisma.productImage.findMany({
        where: { url: { in: candidateUrls } },
        select: { url: true },
      })
    ).map((image) => image.url)
  );

  let destroyed = 0;
  const failedUrls = new Set<string>();
  for (const url of candidateUrls) {
    if (referenced.has(url)) continue;
    const publicId = extractPublicId(url);
    if (!publicId) continue;
    try {
      await cloudinary.uploader.destroy(publicId);
      destroyed += 1;
    } catch (error) {
      // Keep the row so the next run tries again; destroy() is idempotent.
      failedUrls.add(url);
      logError("Failed to destroy orphaned phone upload asset", error, {
        errorId: UPLOAD_FAILED,
        publicId,
      });
    }
  }

  const removable = stale.filter((row) => !failedUrls.has(row.url)).map((row) => row.id);
  if (removable.length > 0) {
    await prisma.phoneUpload.deleteMany({ where: { id: { in: removable } } });
  }

  return { deleted: removable.length, destroyed };
}

/** The message a phone sees once its code's allowance is used up. */
export function phoneAllowanceUsedMessage(maxPhotos: number): string {
  return `This QR code has already sent ${maxPhotos} photo${
    maxPhotos === 1 ? "" : "s"
  }. Generate a new one on your computer to send more.`;
}

/** The message a phone sees once the desktop has finished with the session. */
export const PHONE_SESSION_CLOSED_MESSAGE =
  "Your computer has finished with this listing, so nothing more can be sent to it.";
