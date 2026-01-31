"use client";

import { Row, Column, Heading } from "@buttergolf/ui";
import { ProductCard, ProductCardProps } from "./ProductCard";

interface ProductGridProps {
  title?: string;
  products: ProductCardProps[];
}

export function ProductGrid({ title, products }: ProductGridProps) {
  return (
    <Column gap="$lg" width="100%" padding="$4" maxWidth={1280} alignSelf="center">
      {title && <Heading level={2}>{title}</Heading>}
      <Row flexWrap="wrap" gap="$lg" justifyContent="flex-start">
        {products.map((productProps) => (
          <ProductCard key={productProps.product.id} {...productProps} />
        ))}
      </Row>
    </Column>
  );
}
