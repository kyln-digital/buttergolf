"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Column, Row, ScrollView, Text, Heading, Spinner } from "@buttergolf/ui";
import { ProductCard } from "../../components/ProductCard";
import type { ProductCardData } from "../../types/product";
import { useLink } from "solito/navigation";
import { routes } from "../../navigation";

interface ProductsScreenProps {
  onFetchProducts?: () => Promise<ProductCardData[]>;
}

export function ProductsScreen({ onFetchProducts }: Readonly<ProductsScreenProps>) {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!onFetchProducts) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetchedProducts = await onFetchProducts();
      console.log(`Fetched ${fetchedProducts.length} products`);
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, [onFetchProducts]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return (
    <ScrollView flex={1} backgroundColor="$primary">
      <Column padding="$4" gap="$lg">
        <Heading level={2}>Browse Products</Heading>

        {loading && (
          <Column alignItems="center" paddingVertical="$6">
            <Spinner size="lg" color="$primary" />
            <Text color="$textSecondary" marginTop="$3">
              Loading products...
            </Text>
          </Column>
        )}

        {!loading && products.length === 0 && (
          <Column alignItems="center" paddingVertical="$6">
            <Text color="$textSecondary">No products available</Text>
          </Column>
        )}

        {!loading && products.length > 0 && (
          <Row flexWrap="wrap" gap="$md">
            {products.map((product) => (
              <ProductCardWithLink key={product.id} product={product} />
            ))}
          </Row>
        )}
      </Column>
    </ScrollView>
  );
}

// Helper component to attach Solito link to ProductCard
function ProductCardWithLink({ product }: Readonly<{ product: ProductCardData }>) {
  const linkProps = useLink({
    href: routes.productDetail.replace("[id]", product.id),
  });

  return <ProductCard product={product} onPress={linkProps.onPress} />;
}
