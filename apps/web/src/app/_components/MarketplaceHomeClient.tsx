"use client";

import { Column } from "@buttergolf/ui";
import { HeroStatic } from "./marketplace/HeroStatic";
import { CategoriesSection } from "./marketplace/CategoriesSection";
import { RecentlyListedSectionClient } from "./marketplace/RecentlyListedSection";
import { TrustSection } from "./marketplace/TrustSection";
import { NewsletterSection } from "./marketplace/NewsletterSection";
import { FooterSection } from "./marketplace/FooterSection";
import { AnimatedView } from "./animations/AnimatedView";
import type { ProductCardData } from "@buttergolf/app";

interface MarketplaceHomeClientProps {
  readonly products: ProductCardData[];
}

export default function MarketplaceHomeClient({ products }: Readonly<MarketplaceHomeClientProps>) {
  return (
    <Column width="100%">
      {/* Hero - Immediate page load animation (no scroll trigger) */}
      <AnimatedView delay={0}>
        <HeroStatic />
      </AnimatedView>

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

      <AnimatedView delay={0}>
        <NewsletterSection />
      </AnimatedView>
      <FooterSection />
    </Column>
  );
}
