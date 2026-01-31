"use client";

import { Column, Row, Heading, Text, Button } from "@buttergolf/ui";
import Link from "next/link";

/**
 * SellingPlaceholder Component
 *
 * Temporary placeholder for the Selling section.
 * This will be replaced with dynamic sell page content in the future.
 */
export function SellingPlaceholder() {
  return (
    <Column
      width="100%"
      paddingVertical="$8"
      paddingHorizontal="$md"
      alignItems="center"
      justifyContent="center"
      minHeight={500}
      backgroundColor="$background"
    >
      <Column
        maxWidth={800}
        gap="$lg"
        alignItems="center"
        padding="$8"
        backgroundColor="$surface"
        borderRadius="$2xl"
        borderWidth={1}
        borderColor="$border"
      >
        <Heading level={2} textAlign="center" color="$text">
          Ready to Sell Your Golf Gear?
        </Heading>

        <Text size="$6" align="center" color="$textSecondary">
          List your clubs, bags, shoes, and accessories in minutes. Reach thousands of golfers
          looking for quality equipment.
        </Text>

        <Row gap="$md" flexWrap="wrap" justifyContent="center" marginTop="$md">
          <Link href="/sell" style={{ textDecoration: "none" }}>
            <Button butterVariant="primary" size="$5">
              Start Selling Now
            </Button>
          </Link>
          <Link href="/how-it-works" style={{ textDecoration: "none" }}>
            <Button butterVariant="secondary" size="$5">
              Learn How It Works
            </Button>
          </Link>
        </Row>

        <Column gap="$sm" marginTop="$lg" width="100%">
          <Row gap="$sm" alignItems="center">
            <Text size="$7">✓</Text>
            <Text size="$4" color="$text">
              List items in under 60 seconds
            </Text>
          </Row>
          <Row gap="$sm" alignItems="center">
            <Text size="$7">✓</Text>
            <Text size="$4" color="$text">
              No listing fees - only pay when you sell
            </Text>
          </Row>
          <Row gap="$sm" alignItems="center">
            <Text size="$7">✓</Text>
            <Text size="$4" color="$text">
              Secure payments and buyer protection
            </Text>
          </Row>
          <Row gap="$sm" alignItems="center">
            <Text size="$7">✓</Text>
            <Text size="$4" color="$text">
              Reach a community of passionate golfers
            </Text>
          </Row>
        </Column>
      </Column>
    </Column>
  );
}
