"use client";

import Image from "next/image";
import { Row, Column, Text, Heading } from "@buttergolf/ui";

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

export function TrustSection() {
  return (
    <Column backgroundColor="$background" paddingVertical="$10" width="100%">
      <Column
        maxWidth={1280}
        marginHorizontal="auto"
        paddingHorizontal="$md"
        $gtSm={{ paddingHorizontal: "$xl" }}
        $gtLg={{ paddingHorizontal: "$2xl" }}
        width="100%"
      >
        {/* Main Heading */}
        <Heading
          level={2}
          size="$9"
          $gtMd={{ size: "$10", marginBottom: "$3xl" }}
          color="$text"
          textAlign="center"
          marginBottom="$xl"
        >
          Fresh takes on second-hand reassurance
        </Heading>

        {/* Trust Items Grid */}
        <Column
          style={{ display: "grid" }}
          gridTemplateColumns="1fr"
          gap="$lg"
          $gtSm={{ gap: "$xl" }}
          $gtMd={{
            gridTemplateColumns: "repeat(2, 1fr)",
          }}
          $gtLg={{
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          {TRUST_ITEMS.map((item) => (
            <Row
              key={item.icon}
              alignItems="center"
              gap="$md"
              maxWidth={280}
              marginHorizontal="auto"
            >
              {/* Icon */}
              <Image
                src={item.icon}
                alt=""
                width={56}
                height={56}
                style={{
                  flexShrink: 0,
                  filter:
                    "brightness(0) saturate(100%) invert(39%) sepia(89%) saturate(2532%) hue-rotate(352deg) brightness(98%) contrast(93%)",
                }}
              />

              {/* Text */}
              <Column gap="$xs">
                <Text size="$7" weight="bold" color="$text">
                  {item.title}
                </Text>
                <Text size="$7" weight="bold" color="$text">
                  {item.subtitle}
                </Text>
              </Column>
            </Row>
          ))}
        </Column>
      </Column>
    </Column>
  );
}
