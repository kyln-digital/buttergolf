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
export default async function SellPage() {
  // Check authentication
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in?redirect=/sell");
  }

  // Go straight to the sell form - no gates
  return <SellFormClient />;
}
