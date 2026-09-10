"use client";

import { SellerHub } from "@/app/_components/marketplace/seller-hub/SellerHub";

/**
 * Seller Listings Page
 *
 * SellerHub owns the page header (title, subtitle, "New listing"), so this
 * route just mounts it.
 */
export default function SellerListingsPage() {
  return <SellerHub />;
}
