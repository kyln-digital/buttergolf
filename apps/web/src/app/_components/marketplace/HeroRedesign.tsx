"use client";

import { useRouter } from "next/navigation";
import { Column, Row, Text, Button, Spacer } from "@buttergolf/ui";
import { imagePaths } from "@buttergolf/assets";

/**
 * Redesigned hero section for the web homepage.
 *
 * Layout: centered text overlaid on a butter-texture background with a
 * translucent Vanilla Cream wash and four decorative club-head images
 * positioned absolutely around the content.
 *
 * Matches Figma: jzwthPLmZqztiQNQs40klZ  node 14:155
 */
export function HeroRedesign() {
  const router = useRouter();

  return (
    <Column width="100%" paddingHorizontal="$md" paddingTop="$md" backgroundColor="$surface">
      {/* Rounded hero card */}
      <div
        style={{
          position: "relative",
          maxWidth: 1398,
          width: "100%",
          margin: "0 auto",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {/* Background: butter texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${imagePaths.hero.butterBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            zIndex: 0,
          }}
        />

        {/* Cream overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255, 250, 210, 0.46)",
            zIndex: 0,
          }}
        />

        {/* Decorative club images — absolute positioned, percentages match Figma */}
        {/* Bottom-left: overflows left edge */}
        <img
          src={imagePaths.hero.clubBottomLeft}
          alt=""
          style={{
            position: "absolute",
            left: "1.5%",
            bottom: 0,
            height: "100%",
            width: "auto",
            zIndex: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Center */}
        <img
          src={imagePaths.hero.clubCenter}
          alt=""
          style={{
            position: "absolute",
            left: "40%",
            bottom: 0,
            width: "17%",
            zIndex: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Right-center */}
        <img
          src={imagePaths.hero.clubRightCenter}
          alt=""
          style={{
            position: "absolute",
            left: "70%",
            bottom: 0,
            width: "20%",
            zIndex: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Top-right */}
        <img
          src={imagePaths.hero.clubTopRight}
          alt=""
          style={{
            position: "absolute",
            left: "88%",
            bottom: 0,
            width: "22%",
            zIndex: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Centered content */}
        <Column
          position="relative"
          zIndex={2}
          alignItems="center"
          justifyContent="center"
          paddingVertical="$xl"
          paddingHorizontal="$lg"
          minHeight={300}
          $gtMd={{ minHeight: 360 }}
        >
          <Text
            fontWeight="700"
            color="$text"
            textAlign="center"
            style={{ fontSize: "clamp(34px, 5vw, 74px)", lineHeight: "1.05em" }}
          >
            Butter Up
            <br />
            Your Game
          </Text>

          <Spacer size="$sm" />

          <Text size="$5" color="$text" textAlign="center" fontWeight="500">
            The Marketplace to Buy, Sell &amp; Upgrade
          </Text>

          <Spacer size="$md" />

          <Row gap="$md" justifyContent="center" flexWrap="wrap">
            <Button
              butterVariant="primary"
              size="$4"
              borderRadius="$full"
              paddingHorizontal="$5"
              onPress={() => router.push("/sell")}
            >
              Sell now
            </Button>
            <Button
              butterVariant="secondary"
              size="$4"
              borderRadius="$full"
              paddingHorizontal="$5"
              onPress={() => router.push("/listings")}
            >
              Shop now
            </Button>
          </Row>
        </Column>
      </div>
    </Column>
  );
}
