import { prisma } from "@buttergolf/db";
import type { PhoneUploadSession } from "./phone-upload-session";

/**
 * Persistence for the phone-to-desktop photo handoff: the `phone_uploads`
 * rows a session's uploads land in, and the allowance check that bounds them.
 */

export type RecordPhoneUploadOutcome = "recorded" | "over-cap";

/**
 * Photos already recorded for a session. Cheap enough to run before an upload
 * so an over-limit phone doesn't pay for a photo that will be thrown away;
 * the check that actually enforces the cap is {@link recordPhoneUpload}.
 */
export async function countPhoneUploads(session: PhoneUploadSession): Promise<number> {
  return prisma.phoneUpload.count({
    where: { sessionId: session.sessionId, clerkId: session.clerkId },
  });
}

/**
 * Records an upload if the session still has allowance.
 *
 * The count and the insert run in one transaction under a per-session
 * advisory lock, so concurrent uploads carrying the same token queue here
 * rather than each reading a count below the cap and all getting through.
 * The lock is transaction-scoped, which also makes it safe behind Neon's
 * connection pooler.
 */
export async function recordPhoneUpload(
  session: PhoneUploadSession,
  url: string
): Promise<RecordPhoneUploadOutcome> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${session.sessionId}::text))`;

    const count = await tx.phoneUpload.count({
      where: { sessionId: session.sessionId, clerkId: session.clerkId },
    });
    if (count >= session.maxPhotos) {
      return "over-cap";
    }

    await tx.phoneUpload.create({
      data: { sessionId: session.sessionId, clerkId: session.clerkId, url },
    });
    return "recorded";
  });
}

/** The message a phone sees once its code's allowance is used up. */
export function phoneAllowanceUsedMessage(maxPhotos: number): string {
  return `This QR code has already sent ${maxPhotos} photo${
    maxPhotos === 1 ? "" : "s"
  }. Generate a new one on your computer to send more.`;
}
