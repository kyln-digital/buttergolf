import { prisma } from "@buttergolf/db";

/**
 * Returns de-duplicated subscriber emails for newsletter sends.
 * Use this in server-only jobs/actions that call Resend.
 */
export async function getNewsletterRecipientEmails(): Promise<string[]> {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { subscribedAt: "desc" },
    select: { email: true },
  });

  return subscribers.map((subscriber) => subscriber.email);
}
