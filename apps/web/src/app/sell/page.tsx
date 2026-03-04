import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SellFormClient } from "./_components/SellFormClient";

/**
 * Sell Page - Server Component
 *
 * Zero-friction selling: Users go straight to the listing form.
 * Seller payout setup (phone + Stripe onboarding) is handled separately
 * in Account Settings. Funds are held until seller completes payout setup.
 */
interface SellPageProps {
  searchParams: Promise<{ draftId?: string }>;
}

export default async function SellPage({ searchParams }: SellPageProps) {
  // Check authentication
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in?redirect=/sell");
  }

  const { draftId } = await searchParams;

  // Go straight to the sell form - no gates
  return <SellFormClient draftId={draftId} />;
}
