"use client";

import { useRouter } from "next/navigation";
import type { ProductCardData } from "@buttergolf/app";
import { Button, Column, Row, Text, Heading } from "@buttergolf/ui";
import { ProductCard } from "@/components/ProductCard";

interface MyListingsSectionProps {
  readonly products: ProductCardData[];
}

export function MyListingsSection({ products }: MyListingsSectionProps) {
  const router = useRouter();

  return (
    <Column backgroundColor="$background" paddingVertical="$3xl" width="100%">
      <Column
        maxWidth={1440}
        marginHorizontal="auto"
        paddingHorizontal="$xl"
        width="100%"
        gap="$3xl"
      >
        {/* Header - Centered */}
        <Column alignItems="center" gap="$md" width="100%">
          <Heading level={2} size="$9" $gtMd={{ size: "$10" }} color="$text" textAlign="center">
            My listings
          </Heading>
          <Text size="$6" $gtMd={{ size: "$7" }} color="$textSecondary" textAlign="center">
            List your golf gear in minutes.
          </Text>
        </Column>

        {products.length > 0 ? (
          <>
            {/* 5-column Grid - Responsive breakpoints */}
            <Column
              width="100%"
              style={{ display: "grid" }}
              gridTemplateColumns="repeat(2, 1fr)"
              gap="$md"
              $gtSm={{
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "$lg",
              }}
              $gtMd={{
                gridTemplateColumns: "repeat(4, 1fr)",
              }}
              $gtLg={{
                gridTemplateColumns: "repeat(5, 1fr)",
              }}
            >
              {products.slice(0, 5).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={() => router.push(`/products/${product.id}`)}
                />
              ))}
            </Column>

            {/* View My Listings Button */}
            <Row alignItems="center" justifyContent="center" width="100%" paddingTop="$sm">
              <Button
                butterVariant="primary"
                size="$5"
                width={320}
                onPress={() => router.push("/seller/listings")}
              >
                View my listings
              </Button>
            </Row>
          </>
        ) : (
          /* Empty state */
          <Column alignItems="center" gap="$lg" paddingVertical="$xl">
            <Text size="$6" color="$textSecondary" textAlign="center">
              You have no listings yet.
            </Text>
            <Button butterVariant="primary" size="$5" onPress={() => router.push("/sell")}>
              Sell now
            </Button>
          </Column>
        )}
      </Column>
    </Column>
  );
}
