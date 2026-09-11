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
 * holds the public id the upload *will* use; it is replaced by the asset's URL
 * when the upload succeeds and deleted when it fails. Readers only ever see
 * rows with a real URL.
 *
 * Two sentinel `url` shapes share the table so no schema change is needed:
 * `pending:<publicId>` for a reservation in flight and `closed` for a session
 * the desktop has finished with. Neither is ever returned to a reader.
 */

/** Cloudinary folder every product photo is uploaded into. */
const CLOUDINARY_FOLDER = "products";

/**
 * Prefix marking a reserved slot whose upload hasn't finished. Carrying the
 * public id means an invocation that dies after Cloudinary succeeded but
 * before the row was filled still leaves the sweep enough to destroy the
 * asset; without it the upload would be billable and untraceable.
 */
const PENDING_PREFIX = "pending:";

/**
 * Marks a session the desktop has finished with (published, saved, discarded
 * or replaced by a new code). Uploads against it are refused, so a phone left
 * on the page can't keep filling Cloudinary with photos nobody will collect.
 */
const CLOSED_URL = "closed";

/**
 * A reservation older than this belongs to a request that died mid-upload.
 * The upload route caps its own run time at sixty seconds (`maxDuration`),
 * so a reservation five minutes old cannot still be in flight; ignoring it
 * when counting means a crash can't hold a slot hostage for the rest of the
 * session without ever reclaiming one from a slow but live upload. The row
 * itself is left for the sweep, which knows how to destroy its asset.
 */
const PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Rows older than this belong to sessions nobody can be polling any more.
 * Tokens last fifteen minutes and the desktop restores a session for up to a
 * day after expiry, so a row is at most about a day old while any desktop can
 * still collect it; sweeping at two days leaves a full day between the last
 * possible read and the destroy that would otherwise race it.
 */
export const STALE_UPLOAD_AGE_MS = 48 * 60 * 60 * 1000;

/** Concurrent Cloudinary destroys per sweep batch. */
const SWEEP_DESTROY_CONCURRENCY = 5;

export type ReservePhoneUploadOutcome =
  | { kind: "reserved"; id: string }
  | { kind: "over-cap" }
  | { kind: "closed" };

function isPendingUrl(url: string): boolean {
  return url.startsWith(PENDING_PREFIX);
}

function isSentinelUrl(url: string): boolean {
  return url === CLOSED_URL || isPendingUrl(url);
}

/** Cloudinary public id (folder included) behind a row, pending or complete. */
function publicIdFor(url: string): string | null {
  if (url === CLOSED_URL) return null;
  if (isPendingUrl(url)) return `${CLOUDINARY_FOLDER}/${url.slice(PENDING_PREFIX.length)}`;
  return extractPublicId(url);
}

/**
 * Takes one slot of the session's allowance, atomically, recording the public
 * id the upload will use. Returns `over-cap` when the allowance is used up,
 * counting slots still reserved by in-flight uploads, and `closed` once the
 * desktop has finished with the session. The lock is transaction-scoped,
 * which also keeps it safe behind Neon's connection pooler.
 */
export async function reservePhoneUploadSlot(
  session: PhoneUploadSession,
  publicId: string
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

    // Everything but the closed marker and reservations old enough to be dead.
    const taken = await tx.phoneUpload.count({
      where: {
        sessionId,
        clerkId,
        url: { not: CLOSED_URL },
        NOT: {
          AND: [
            { url: { startsWith: PENDING_PREFIX } },
            { createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
          ],
        },
      },
    });
    if (taken >= maxPhotos) {
      return { kind: "over-cap" };
    }

    const row = await tx.phoneUpload.create({
      data: { sessionId, clerkId, url: `${PENDING_PREFIX}${publicId}` },
      select: { id: true },
    });
    return { kind: "reserved", id: row.id };
  });
}

export type CompletePhoneUploadOutcome = "completed" | "closed";

/**
 * Fills a reserved slot with the uploaded asset, making it visible to the
 * desktop. Takes the same per-session lock as close, and refuses if the
 * desktop closed the session while the upload was in flight: filling it then
 * would tell the phone "sent" for a photo no desktop will ever collect. The
 * caller destroys the asset and releases the slot on `closed`.
 */
export async function completePhoneUpload(
  session: PhoneUploadSession,
  reservationId: string,
  url: string
): Promise<CompletePhoneUploadOutcome> {
  const { sessionId, clerkId } = session;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}::text))`;

    const closed = await tx.phoneUpload.findFirst({
      where: { sessionId, clerkId, url: CLOSED_URL },
      select: { id: true },
    });
    if (closed) {
      return "closed";
    }

    await tx.phoneUpload.update({ where: { id: reservationId }, data: { url } });
    return "completed";
  });
}

/**
 * Gives a reserved slot back after a failed upload. Never throws: the phone is
 * already getting an error, and a slot that leaks here stops counting after
 * the pending TTL anyway. Callers should still await it, since a serverless
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
    where: {
      sessionId,
      clerkId,
      url: { not: CLOSED_URL },
      NOT: { url: { startsWith: PENDING_PREFIX } },
    },
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
 * Marks a session finished, so a phone left on the page gets a clear refusal
 * instead of uploading photos nobody will collect. Existing rows are left
 * alone: completed ones may still be held by an unsaved form, and a
 * reservation in flight will either fill itself (and be swept later if never
 * collected) or be released by its own request. Idempotent.
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
  });
}

export interface SweepPhoneUploadsResult {
  /** Handoff rows removed. */
  deleted: number;
  /** Cloudinary assets destroyed because no product image references them. */
  destroyed: number;
}

/** Destroys one asset unless a listing has come to reference it since the batch was read. */
async function destroyIfUnreferenced(url: string): Promise<"destroyed" | "kept" | "failed"> {
  const publicId = publicIdFor(url);
  if (!publicId) return "kept";

  // A completed row's URL could have been placed by a desktop between the
  // batch lookup and now. Ask again immediately before destroying; the
  // two-day sweep age makes that window academic, but the check is cheap.
  if (!isPendingUrl(url)) {
    const nowReferenced = await prisma.productImage.findFirst({
      where: { url },
      select: { id: true },
    });
    if (nowReferenced) return "kept";
  }

  try {
    await cloudinary.uploader.destroy(publicId);
    return "destroyed";
  } catch (error) {
    logError("Failed to destroy orphaned phone upload asset", error, {
      errorId: UPLOAD_FAILED,
      publicId,
    });
    return "failed";
  }
}

/**
 * Removes handoff rows older than {@link STALE_UPLOAD_AGE_MS}, destroying the
 * Cloudinary asset behind any whose URL never made it into a product image and
 * behind any reservation that was never filled. A phone photo the desktop
 * placed becomes a `ProductImage` on the listing's autosaved draft within
 * seconds, so anything still unreferenced two days later was never collected
 * (or was removed again) and would otherwise stay billable for good. Run daily
 * by the `sweep-phone-uploads` cron; bounded per run and destroying a few at a
 * time so it stays inside the function's time budget. Rows whose destroy
 * fails are kept for the next run; `destroy` is idempotent.
 */
export async function sweepStalePhoneUploads(limit = 50): Promise<SweepPhoneUploadsResult> {
  const stale = await prisma.phoneUpload.findMany({
    where: { createdAt: { lt: new Date(Date.now() - STALE_UPLOAD_AGE_MS) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, url: true },
  });

  if (stale.length === 0) {
    return { deleted: 0, destroyed: 0 };
  }

  const completedUrls = Array.from(
    new Set(stale.map((row) => row.url).filter((url) => !isSentinelUrl(url)))
  );
  const referenced = new Set(
    (
      await prisma.productImage.findMany({
        where: { url: { in: completedUrls } },
        select: { url: true },
      })
    ).map((image) => image.url)
  );

  const toDestroy = Array.from(
    new Set(stale.map((row) => row.url).filter((url) => url !== CLOSED_URL && !referenced.has(url)))
  );

  let destroyed = 0;
  const failedUrls = new Set<string>();
  for (let i = 0; i < toDestroy.length; i += SWEEP_DESTROY_CONCURRENCY) {
    const batch = toDestroy.slice(i, i + SWEEP_DESTROY_CONCURRENCY);
    const outcomes = await Promise.all(batch.map((url) => destroyIfUnreferenced(url)));
    outcomes.forEach((outcome, index) => {
      if (outcome === "destroyed") destroyed += 1;
      if (outcome === "failed") failedUrls.add(batch[index]);
    });
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
