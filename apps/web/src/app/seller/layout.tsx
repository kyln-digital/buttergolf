"use client";

import { usePathname } from "next/navigation";
import { Column, Row } from "@buttergolf/ui";
import { SellerDashboardNav } from "./_components/SellerDashboardNav";
import { PayoutRequirementsBanner } from "./_components/PayoutRequirementsBanner";
import { PayoutStatusProvider, usePayoutStatus } from "@/hooks/usePayoutStatus";

/**
 * Seller Dashboard Layout
 *
 * Wraps every /seller/* page with the sidebar navigation and, when the seller
 * still has something to do before we can pay them, a slim banner above the
 * content.
 *
 * The status fetch never gates the page: children render straight away and the
 * banner appears once the status arrives. /seller/payouts is excluded because
 * that page already shows the full picture.
 */
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PayoutStatusProvider>
      <SellerLayoutFrame>{children}</SellerLayoutFrame>
    </PayoutStatusProvider>
  );
}

/**
 * Reads the shared status the provider above fetched once, so the banner and
 * the page underneath never trigger a second Stripe account read.
 */
function SellerLayoutFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = usePayoutStatus();

  const isPayoutsPage = pathname?.startsWith("/seller/payouts") ?? false;

  return (
    <Column fullWidth minHeight="calc(100vh - 80px)">
      <Row fullWidth flex={1}>
        <SellerDashboardNav />

        <Column flex={1} padding="$lg" backgroundColor="$background" gap="$md">
          {!isPayoutsPage && <PayoutRequirementsBanner status={status} />}
          {children}
        </Column>
      </Row>
    </Column>
  );
}
