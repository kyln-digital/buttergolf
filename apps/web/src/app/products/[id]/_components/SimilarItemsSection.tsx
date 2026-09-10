"use client";

import type { ProductCardData } from "@buttergolf/app";
import { ProductCard } from "@/components/ProductCard";
import { CardGrid, Section, SectionHeader } from "@/app/_components/marketplace/Section";

interface SimilarItemsSectionProps {
  products: ProductCardData[];
  category: string;
}

export function SimilarItemsSection({ products, category }: SimilarItemsSectionProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <Section label="Similar items">
      <SectionHeader
        title="Similar items"
        subtitle={`Other ${category.toLowerCase()} items you might like`}
      />
      <CardGrid maxColumns={4}>
        {products.slice(0, 8).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </CardGrid>
    </Section>
  );
}
