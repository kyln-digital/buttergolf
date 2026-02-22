"use client";

import Link from "next/link";
import { Row, Column, Text, Image, Badge } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";

interface SearchResultItemProps {
  product: ProductCardData;
  onSelect?: () => void;
}

export function SearchResultItem({ product, onSelect }: SearchResultItemProps) {
  return (
    <Link href={`/products/${product.id}`} onClick={onSelect}>
      <Row
        padding="$3"
        gap="$3"
        hoverStyle={{ backgroundColor: "$backgroundHover" }}
        cursor="pointer"
        alignItems="center"
        width="100%"
      >
        {/* Product Thumbnail */}
        <Image
          src={product.imageUrl}
          width={60}
          height={60}
          borderRadius="$sm"
          objectFit="cover"
          alt={product.title}
        />

        {/* Product Details */}
        <Column flex={1} gap="$xs">
          <Text weight="semibold" numberOfLines={1} size="$3">
            {product.title}
          </Text>
          <Row gap="$2" alignItems="center" flexWrap="wrap">
            <Text size="$2" {...{ color: "$textMuted" }}>
              {product.category}
            </Text>
            {product.condition && (
              <Badge variant="neutral" size="sm">
                {product.condition.replace(/_/g, " ")}
              </Badge>
            )}
          </Row>
        </Column>

        {/* Price */}
        <Text weight="bold" {...{ color: "$primary" }} flexShrink={0}>
          £{product.price.toFixed(2)}
        </Text>
      </Row>
    </Link>
  );
}
