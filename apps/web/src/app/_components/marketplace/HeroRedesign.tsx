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
 * Matches Figma: jzwthPLmZqztiQNQs40klZ  node 10:5416
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
            backgroundColor: "rgba(255, 250, 210, 0.6)",
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
            left: "-2%",
            top: "3%",
            width: "29%",
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
            left: "37%",
            top: "28%",
            width: "24%",
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
            left: "62%",
            top: "27%",
            width: "31%",
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
            left: "77%",
            top: "10%",
            width: "30%",
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
          paddingVertical="$2xl"
          paddingHorizontal="$lg"
          minHeight={350}
          $gtMd={{ minHeight: 420 }}
        >
          <Text
            fontWeight="700"
            color="$primary"
            textAlign="center"
            style={{ fontSize: "clamp(36px, 5.5vw, 80px)" }}
            lineHeight={1.1}
          >
            {"Butter Up\nYour Game "}
          </Text>

          <Spacer size="$md" />

          <Text size="$6" color="$text" textAlign="center">
            The Marketplace to Buy, Sell &amp; Upgrade
          </Text>

          <Spacer size="$lg" />

          <Row gap="$md" justifyContent="center" flexWrap="wrap">
            <Button
              butterVariant="primary"
              size="$5"
              borderRadius="$full"
              paddingHorizontal="$6"
              onPress={() => router.push("/sell")}
            >
              Sell now
            </Button>
            <Button
              butterVariant="secondary"
              size="$5"
              borderRadius="$full"
              paddingHorizontal="$6"
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
