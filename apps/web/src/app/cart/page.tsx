"use client";

import { Column, Row, Text, Button, Card, Image } from "@buttergolf/ui";
import { useCart } from "../../context/CartContext";
import Link from "next/link";

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <Column
        minHeight="60vh"
        alignItems="center"
        justifyContent="center"
        gap="$4"
        paddingHorizontal="$4"
      >
        <Text size="$7" weight="bold">
          Your cart is empty
        </Text>
        <Text color="$textSecondary">Browse our marketplace to find great deals</Text>
        <Link href="/listings">
          <Button butterVariant="primary" size="$5">
            Browse Listings
          </Button>
        </Link>
      </Column>
    );
  }

  return (
    <Column
      maxWidth={1280}
      marginHorizontal="auto"
      paddingHorizontal="$6"
      paddingVertical="$8"
      gap="$6"
      width="100%"
    >
      <Row alignItems="center" justifyContent="space-between">
        <Text size="$7" weight="bold">
          Shopping Cart ({items.length} {items.length === 1 ? "item" : "items"})
        </Text>
        <Button chromeless onPress={clearCart}>
          Clear Cart
        </Button>
      </Row>

      <Row gap="$6" flexWrap="wrap" alignItems="flex-start">
        {/* Cart Items */}
        <Column flex={1} gap="$4" minWidth={300}>
          {items.map((item) => (
            <Card key={item.productId} variant="outlined" padding="$md">
              <Row gap="$4" alignItems="center">
                <Image
                  src={item.imageUrl}
                  width={80}
                  height={80}
                  borderRadius="$md"
                  objectFit="cover"
                  alt={item.title}
                />
                <Column flex={1} gap="$2">
                  <Text size="$4" weight="semibold">
                    {item.title}
                  </Text>
                  <Text size="$6" weight="bold" color="$primary">
                    £{item.price.toFixed(2)}
                  </Text>
                </Column>
                <Row gap="$2" alignItems="center">
                  <Button
                    size="$3"
                    onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    -
                  </Button>
                  <Text size="$4" minWidth={30} textAlign="center">
                    {item.quantity}
                  </Text>
                  <Button
                    size="$3"
                    onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    +
                  </Button>
                </Row>
                <Button size="$3" onPress={() => removeItem(item.productId)}>
                  Remove
                </Button>
              </Row>
            </Card>
          ))}
        </Column>

        {/* Order Summary */}
        <Card variant="elevated" padding="$lg" minWidth={300} width="100%" maxWidth={400}>
          <Column gap="$4">
            <Text size="$6" weight="bold">
              Order Summary
            </Text>
            <Column gap="$2">
              {items.map((item) => (
                <Row key={item.productId} justifyContent="space-between" alignItems="center">
                  <Text size="$3" color="$textSecondary">
                    {item.title} × {item.quantity}
                  </Text>
                  <Text size="$3">£{(item.price * item.quantity).toFixed(2)}</Text>
                </Row>
              ))}
            </Column>
            <Row
              paddingTop="$4"
              borderTopWidth={1}
              borderColor="$border"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text size="$6" weight="bold">
                Total
              </Text>
              <Text size="$7" weight="bold" color="$primary">
                £{totalPrice.toFixed(2)}
              </Text>
            </Row>
            <Button butterVariant="primary" size="$5" width="100%">
              Proceed to Checkout
            </Button>
            <Link href="/listings">
              <Button butterVariant="secondary" size="$4" width="100%">
                Continue Shopping
              </Button>
            </Link>
          </Column>
        </Card>
      </Row>
    </Column>
  );
}
