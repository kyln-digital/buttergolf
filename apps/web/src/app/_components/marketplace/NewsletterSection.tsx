"use client";

import { Button, Input, Text, Row, Column } from "@buttergolf/ui";

export function NewsletterSection() {
  return (
    <Column paddingVertical="$10" backgroundColor="$background">
      <Column
        maxWidth={800}
        marginHorizontal="auto"
        paddingHorizontal="$4"
        width="100%"
        gap="$lg"
        alignItems="center"
      >
        <Column gap="$sm" alignItems="center">
          <Text size="$8" weight="bold" color="$text" textAlign="center">
            Don&apos;t miss deals
          </Text>
          <Text color="$textSecondary" size="$5" textAlign="center">
            Get the latest listings and price drops in your inbox
          </Text>
        </Column>
        <Row
          gap="$md"
          maxWidth={500}
          width="100%"
          alignItems="center"
          $maxSm={{ flexDirection: "column" }}
        >
          <Input
            flex={1}
            size="lg"
            placeholder="you@example.com"
            borderRadius="$full"
            paddingHorizontal="$4"
          />
          <Button
            butterVariant="primary"
            size="$5"
            flexShrink={0}
            paddingHorizontal="$6"
            $maxSm={{ width: "100%" }}
          >
            Subscribe
          </Button>
        </Row>
      </Column>
    </Column>
  );
}
