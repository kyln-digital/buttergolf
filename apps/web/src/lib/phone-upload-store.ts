import { prisma } from "@buttergolf/db";
import { logError, UPLOAD_FAILED } from "@buttergolf/constants";
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
 */

/** Marks a reserved slot whose upload hasn't finished. Never shown to readers. */
const PENDING_URL = "";

/**
 * A reservation older than this belongs to a request that died mid-upload
 * (a 10MB body finishes long before it). Treated as free so a crash can't
 * hold a slot hostage for the rest of the session.
 */
const PENDING_TTL_MS = 5 * 60 * 1000;

export type ReservePhoneUploadOutcome = { kind: "reserved"; id: string } | { kind: "over-cap" };

/**
 * Takes one slot of the session's allowance, atomically. Returns `over-cap`
 * when the allowance is used up, counting slots still reserved by in-flight
 * uploads. The lock is transaction-scoped, which also keeps it safe behind
 * Neon's connection pooler.
 */
export async function reservePhoneUploadSlot(
  session: PhoneUploadSession
): Promise<ReservePhoneUploadOutcome> {
  const { sessionId, clerkId, maxPhotos } = session;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}::text))`;

    await tx.phoneUpload.deleteMany({
      where: {
        sessionId,
        clerkId,
        url: PENDING_URL,
        createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) },
      },
    });

    const taken = await tx.phoneUpload.count({ where: { sessionId, clerkId } });
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
    where: { sessionId, clerkId, url: { not: PENDING_URL } },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true },
  });
}

/** The message a phone sees once its code's allowance is used up. */
export function phoneAllowanceUsedMessage(maxPhotos: number): string {
  return `This QR code has already sent ${maxPhotos} photo${
    maxPhotos === 1 ? "" : "s"
  }. Generate a new one on your computer to send more.`;
}
