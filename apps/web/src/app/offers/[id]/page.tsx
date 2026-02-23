import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@buttergolf/db";

/**
 * Legacy offer detail page — redirects to conversation-based messaging.
 * Route: /offers/[id] → /messages/[conversationId]
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OfferDetailPage({ params }: PageProps) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  // Look up the offer to find its conversation
  const offer = await prisma.offer.findUnique({
    where: { id },
    select: { conversationId: true },
  });

  if (offer?.conversationId) {
    redirect(`/messages/${offer.conversationId}`);
  }

  // Fallback: go to messages index
  redirect("/messages");
}
