"use client";

import { SellerHub } from "@/app/_components/marketplace/seller-hub/SellerHub";
import { Column, Heading, Text } from "@buttergolf/ui";

/**
 * Seller Listings Page
 *
 * Displays the existing SellerHub component for managing product listings.
 * This integrates the existing functionality into the new seller dashboard.
 */
export default function SellerListingsPage() {
  return (
    <Column gap="$lg" fullWidth>
      <Column gap="$xs">
        <Heading level={2}>My Listings</Heading>
        <Text color="$textSecondary">Manage your active and sold listings</Text>
      </Column>

      <SellerHub />
    </Column>
  );
}
