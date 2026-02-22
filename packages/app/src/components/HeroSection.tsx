"use client";

import { Row, Column, Heading, Button } from "@buttergolf/ui";
import { SearchBar } from "./SearchBar";

export function HeroSection() {
  return (
    <Column
      backgroundColor="$primary"
      paddingVertical="$8"
      paddingHorizontal="$4"
      alignItems="center"
      gap="$lg"
      borderBottomWidth={1}
      borderBottomColor="$border"
    >
      <Column alignItems="center" gap="$sm" maxWidth={800}>
        <Heading level={1} size="$10" align="center" fontWeight="700">
          Ready to declutter your golf bag?
        </Heading>
        <Heading level={3} size="$6" align="center" color="$textSecondary" fontWeight="400">
          Buy and sell pre-owned golf equipment with ease
        </Heading>
      </Column>

      <SearchBar />

      <Row gap="$sm" flexWrap="wrap" justifyContent="center">
        <Button
          size="$4"
          backgroundColor="$background"
          borderRadius="$10"
          hoverStyle={{ backgroundColor: "$primaryHover" }}
          pressStyle={{ backgroundColor: "$primaryPress" }}
        >
          <Button.Text color="$textInverse">Sell now</Button.Text>
        </Button>
        <Button
          size="$4"
          backgroundColor="$background"
          borderRadius="$10"
          hoverStyle={{ backgroundColor: "$secondaryHover" }}
          pressStyle={{ backgroundColor: "$secondaryPress" }}
        >
          <Button.Text color="$text">Learn how it works</Button.Text>
        </Button>
      </Row>
    </Column>
  );
}
