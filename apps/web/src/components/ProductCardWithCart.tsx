"use client";

import Link from "next/link";
import { Card, Image, Text, Row, Column, Badge, Button } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ProductCardWithCartProps {
  product: ProductCardData;
}

export function ProductCardWithCart({ product }: Readonly<ProductCardWithCartProps>) {
  const router = useRouter();
  const [purchasing, setPurchasing] = useState(false);

  const handleBuyNow = () => {
    setPurchasing(true);
    router.push(`/checkout?productId=${product.id}`);
  };

  return (
    <Card
      variant="elevated"
      padding={0}
      transition="bouncy"
      backgroundColor="$surface"
      borderColor="$border"
      hoverStyle={{
        borderColor: "$borderHover",
        shadowColor: "$shadowColorHover",
        shadowRadius: 12,
      }}
      width="100%"
      maxWidth={280}
      minHeight={440}
      display="flex"
      flexDirection="column"
    >
      <Card.Header padding={0} noBorder position="relative">
        <Link
          href={`/products/${product.id}`}
          style={{ cursor: "pointer", display: "block" }}
          aria-label={`View details for ${product.title}`}
        >
          {/* 1:1 Aspect Ratio Container */}
          <div
            style={{
              position: "relative",
              paddingBottom: "100%",
              overflow: "hidden",
              width: "100%",
            }}
          >
            <Image
              src={product.imageUrl}
              width="100%"
              height="100%"
              objectFit="cover"
              borderTopLeftRadius="$lg"
              borderTopRightRadius="$lg"
              alt={product.title}
              backgroundColor="$background"
              position="absolute"
              top={0}
              left={0}
            />
          </div>
        </Link>

        {/* NEW Badge Overlay */}
        {product.condition === "NEW" && (
          <Badge variant="success" size="sm" position="absolute" top={8} right={8} zIndex={10}>
            <Text>NEW</Text>
          </Badge>
        )}
      </Card.Header>
      <Card.Body padding="$md" flex={1} display="flex">
        <Column gap="$md" width="100%" height="100%" justifyContent="space-between">
          <Link
            href={`/products/${product.id}`}
            style={{
              cursor: "pointer",
              display: "block",
              color: "inherit",
              textDecoration: "none",
            }}
            aria-label={`View ${product.title}`}
          >
            <Column gap="$xs" width="100%">
              <Text size="$4" weight="semibold" numberOfLines={2} minHeight={42}>
                {product.title}
              </Text>
              <Row gap="$sm" alignItems="center" justifyContent="space-between" minHeight={24}>
                <Text size="$3" color="$textSecondary" numberOfLines={1}>
                  {product.category}
                </Text>
                {product.condition && product.condition !== "NEW" && (
                  <Badge variant="neutral" size="sm">
                    <Text size="$2" weight="medium">
                      {product.condition.replace("_", " ")}
                    </Text>
                  </Badge>
                )}
              </Row>
              <Text size="$6" weight="bold" color="$primary" minHeight={28}>
                £{product.price.toFixed(2)}
              </Text>
            </Column>
          </Link>
          <Button
            size="$4"
            width="100%"
            onPress={handleBuyNow}
            disabled={purchasing}
            opacity={purchasing ? 0.6 : 1}
          >
            {purchasing ? "Processing..." : "Buy Now"}
          </Button>
        </Column>
      </Card.Body>
    </Card>
  );
}
