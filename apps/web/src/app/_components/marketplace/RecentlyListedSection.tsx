"use client";

import { useLinkPress } from "@/hooks/useLinkPress";
import type { ProductCardData } from "@buttergolf/app";
import { Button, Row } from "@buttergolf/ui";
import { ProductCard } from "@/components/ProductCard";
import { CardGrid, Section, SectionHeader } from "./Section";

interface RecentlyListedSectionClientProps {
  readonly products: ProductCardData[];
}

export function RecentlyListedSectionClient({ products }: RecentlyListedSectionClientProps) {
  const linkPress = useLinkPress();

  return (
    <Section label="Recently listed">
      <SectionHeader
        title="Recently listed"
        subtitle="Latest drops, hottest deals - upgrade your game today."
      />

      <CardGrid maxColumns={5}>
        {products.slice(0, 5).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </CardGrid>

      <Row justifyContent="center" width="100%">
        <Button
          butterVariant="secondary"
          size="$5"
          tag="a"
          href="/listings"
          onPress={linkPress("/listings")}
        >
          View all listings
        </Button>
      </Row>
    </Section>
  );
}
