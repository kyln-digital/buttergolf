"use client";

import { useLinkPress } from "@/hooks/useLinkPress";
import type { ProductCardData } from "@buttergolf/app";
import { Button, Column, Row, Text } from "@buttergolf/ui";
import { ProductCard } from "@/components/ProductCard";
import { CardGrid, Section, SectionHeader } from "./Section";

interface MyListingsSectionProps {
  readonly products: ProductCardData[];
}

export function MyListingsSection({ products }: MyListingsSectionProps) {
  const linkPress = useLinkPress();

  return (
    <Section label="My listings">
      <SectionHeader title="My listings" subtitle="List your golf gear in minutes." />

      {products.length > 0 ? (
        <>
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
              href="/seller/listings"
              onPress={linkPress("/seller/listings")}
            >
              View my listings
            </Button>
          </Row>
        </>
      ) : (
        <Column alignItems="center" gap="$md" paddingVertical="$lg">
          <Text size="$5" color="$textSecondary" textAlign="center">
            You have no listings yet.
          </Text>
          <Button
            butterVariant="primary"
            size="$5"
            tag="a"
            href="/sell"
            onPress={linkPress("/sell")}
          >
            Sell now
          </Button>
        </Column>
      )}
    </Section>
  );
}
