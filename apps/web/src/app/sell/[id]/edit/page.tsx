import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@buttergolf/db";
import { SellFormClient } from "../../_components/SellFormClient";

/**
 * Edit Listing Page - Server Component
 *
 * Reuses the full sell form (and its ButterGolf background) rather than a
 * cramped modal, so editing a listing looks and behaves like creating one.
 */
interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;

  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/sell/${id}/edit`)}`);
  }

  // Only the owner may edit their own listing.
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      isDraft: true,
      user: { select: { clerkId: true } },
    },
  });

  if (!product || product.user.clerkId !== clerkId) {
    notFound();
  }

  // A draft goes down the draft path so that saving publishes it; a live
  // listing goes down the edit path so that saving keeps it live.
  return product.isDraft ? (
    <SellFormClient draftId={product.id} />
  ) : (
    <SellFormClient editProductId={product.id} />
  );
}
