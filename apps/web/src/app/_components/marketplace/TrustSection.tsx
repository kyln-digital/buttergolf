"use client";

import Image from "next/image";
import { Row, Column, Text } from "@buttergolf/ui";
import { Section, SectionHeader } from "./Section";

const TRUST_ITEMS = [
  {
    icon: "/_assets/icons/golfball.svg",
    title: "Trusted Gear,",
    subtitle: "Tee to Green",
  },
  {
    icon: "/_assets/icons/club.svg",
    title: "Golf Kit, No",
    subtitle: "Guesswork",
  },
  {
    icon: "/_assets/icons/badge.svg",
    title: "Quality You",
    subtitle: "Can Count On",
  },
  {
    icon: "/_assets/icons/tick.svg",
    title: "Checked, Tested,",
    subtitle: "Approved",
  },
];

/** Tints the single-colour SVG icons Spiced Clementine. */
const ICON_TINT =
  "brightness(0) saturate(100%) invert(39%) sepia(89%) saturate(2532%) hue-rotate(352deg) brightness(98%) contrast(93%)";

export function TrustSection() {
  return (
    <Section label="Why ButterGolf">
      <SectionHeader title="Fresh takes on second-hand reassurance" />

      <Column
        style={{ display: "grid" }}
        gridTemplateColumns="1fr"
        gap="$lg"
        $gtXs={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "$xl" }}
        $gtMd={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        {TRUST_ITEMS.map((item) => (
          <Row
            key={item.icon}
            alignItems="center"
            gap="$md"
            width="100%"
            maxWidth={300}
            marginHorizontal="auto"
          >
            <Image
              src={item.icon}
              alt=""
              width={48}
              height={48}
              style={{ flexShrink: 0, filter: ICON_TINT }}
            />
            <Column>
              <Text size="$6" fontWeight="600" color="$text">
                {item.title}
              </Text>
              <Text size="$6" fontWeight="600" color="$text">
                {item.subtitle}
              </Text>
            </Column>
          </Row>
        ))}
      </Column>
    </Section>
  );
}
