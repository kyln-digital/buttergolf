"use client";

import { Column, Heading, Text } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { ProductCarousel } from "../../../_components/shared/ProductCarousel";

interface SimilarItemsSectionProps {
  products: ProductCardData[];
  category: string;
}

export function SimilarItemsSection({ products, category }: SimilarItemsSectionProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <Column paddingVertical="$3xl" backgroundColor="$surface" width="100%">
      <Column
        maxWidth={1440}
        marginHorizontal="auto"
        paddingHorizontal="$xl"
        width="100%"
        gap="$3xl"
      >
        {/* Header */}
        <Column alignItems="center" gap="$md" width="100%">
          <Heading level={2} size="$9" $gtMd={{ size: "$10" }} color="$text" textAlign="center">
            Similar Items
          </Heading>
          <Text size="$6" $gtMd={{ size: "$7" }} color="$textSecondary" textAlign="center">
            Other {category.toLowerCase()} items you might like
          </Text>
        </Column>

        {/* Products Carousel */}
        <ProductCarousel products={products} autoplay={true} autoplayDelay={5000} />
      </Column>
    </Column>
  );
}
