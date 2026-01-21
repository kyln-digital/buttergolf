"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Column } from "@buttergolf/ui";
import { HeroStatic } from "./marketplace/HeroStatic";
import { BuySellToggle } from "./marketplace/BuySellToggle";
import { CategoriesSection } from "./marketplace/CategoriesSection";
import { SellingPlaceholder } from "./marketplace/SellingPlaceholder";
import { SellerHub } from "./marketplace/seller-hub/SellerHub";
import { RecentlyListedSectionClient } from "./marketplace/RecentlyListedSection";
import { TrustSection } from "./marketplace/TrustSection";
import { NewsletterSection } from "./marketplace/NewsletterSection";
import { FooterSection } from "./marketplace/FooterSection";
import { AnimatedView } from "./animations/AnimatedView";
import type { ProductCardData } from "@buttergolf/app";

interface MarketplaceHomeClientProps {
  readonly products: ProductCardData[];
}

export default function MarketplaceHomeClient({
  products,
}: Readonly<MarketplaceHomeClientProps>) {
  const [activeMode, setActiveMode] = useState<"buying" | "selling">("buying");
  const { isSignedIn } = useUser();

  return (
    <Column width="100%">
      {/* Hero - Immediate page load animation (no scroll trigger) */}
      <AnimatedView delay={0}>
        <HeroStatic />
      </AnimatedView>

      {/* Buy/Sell Toggle - Immediate page load animation (delay removed to fix cascade) */}
      <AnimatedView delay={0}>
        <Column paddingTop="$6" paddingBottom="$4" backgroundColor="$surface">
          <BuySellToggle activeMode={activeMode} onModeChange={setActiveMode} />
        </Column>
      </AnimatedView>

      {/* Conditionally render based on active mode */}
      {activeMode === "buying" ? (
        <>
          {/* Categories Section - Immediate page load animation (delay removed) */}
          <AnimatedView delay={0}>
            <CategoriesSection />
          </AnimatedView>

          {/* Below the fold sections - simple fade in (delays removed) */}
          <AnimatedView delay={0}>
            <RecentlyListedSectionClient products={products} />
          </AnimatedView>
          <AnimatedView delay={0}>
            <TrustSection />
          </AnimatedView>
        </>
      ) : (
        <AnimatedView delay={0}>
          {isSignedIn ? <SellerHub /> : <SellingPlaceholder />}
        </AnimatedView>
      )}

      <AnimatedView delay={0}>
        <NewsletterSection />
      </AnimatedView>
      <FooterSection />
    </Column>
  );
}
