"use client";

import React from "react";
import { Platform, Image as RNImage, Dimensions } from "react-native";
import { Column, Row, Heading, Text, Button, View, Image, useMedia } from "@buttergolf/ui";
import { images } from "@buttergolf/assets";
import { useLink } from "solito/navigation";
import { FadeUpText } from "./FadeUpText";

// Image source types - accepts both React Native require() and web string paths
// Also supports React components (for SVG imports via react-native-svg-transformer)
type ImageSource =
  | string
  | { uri: string }
  | number
  | React.ComponentType<{ width?: number | string; height?: number | string }>;

export interface HeroProps {
  // Content
  readonly heading: string | { line1: string; line2?: string; line3?: string };
  readonly subtitle?: string;

  // CTAs (optional - omit for mobile button-less variant)
  readonly primaryCta?: {
    label: string;
    href: string;
  };
  readonly secondaryCta?: {
    label: string;
    href: string;
  };

  // Images - accepts both require() (mobile) and string (web)
  readonly backgroundImage: ImageSource;
  readonly heroImage?: ImageSource;

  // Layout controls
  readonly showHeroImage?: boolean; // Default: true on desktop, false on mobile
  readonly minHeight?: number; // Default: 500
  readonly maxHeight?: number; // Default: 700

  // Animation controls (desktop only)
  readonly animationVariant?: "fade-up" | "none";
  readonly animationDelay?: number; // Delay before animation starts (in seconds)
}

// Helper to get heading text
function getHeadingText(
  heading: string | { line1: string; line2?: string; line3?: string }
): string {
  if (typeof heading === "string") return heading;
  return [heading.line1, heading.line2, heading.line3].filter(Boolean).join(" ");
}

// Helper to get heading lines as array
function getHeadingLines(
  heading: string | { line1: string; line2?: string; line3?: string }
): string[] {
  if (typeof heading === "string") return [heading];
  return [heading.line1, heading.line2, heading.line3].filter((line): line is string =>
    Boolean(line)
  );
}

// Helper to check if image is an SVG component
function isSvgComponent(image: ImageSource): image is React.ComponentType<{
  width?: number | string;
  height?: number | string;
}> {
  // SVG imports via react-native-svg-transformer have a .default property that's a component
  if (typeof image === "object" && image !== null && "default" in image) {
    return typeof (image as { default: unknown }).default === "function";
  }
  return typeof image === "function";
}

// Helper to get SVG component from import
function getSvgComponent(image: ImageSource): React.ComponentType<{
  width?: number | string;
  height?: number | string;
}> | null {
  if (typeof image === "object" && image !== null && "default" in image) {
    return (
      image as {
        default: React.ComponentType<{
          width?: number | string;
          height?: number | string;
        }>;
      }
    ).default;
  }
  if (typeof image === "function") {
    return image as React.ComponentType<{
      width?: number | string;
      height?: number | string;
    }>;
  }
  return null;
}

// Helper to get image source in correct format
function getImageSource(image: ImageSource): { uri: string } | number | null {
  if (isSvgComponent(image)) {
    return null; // SVG components are handled separately
  }
  if (typeof image === "string") {
    return { uri: image };
  }
  return image as { uri: string } | number;
}

// Shared heading style - scales with viewport width
// Note: color is set dynamically in HeroHeading using useTheme() for dark mode support
const headingStyle = {
  fontSize: "clamp(36px, 5.5vw, 80px)",
  fontWeight: 700,
  lineHeight: 1.15,
  whiteSpace: "normal" as const,
  wordBreak: "keep-all" as const,
};

interface HeroHeadingProps {
  readonly heading: string | { line1: string; line2?: string; line3?: string };
  readonly animationVariant: "fade-up" | "none";
  readonly animationDelay: number;
  readonly multiLine?: boolean;
}

function HeroHeading({
  heading,
  animationVariant,
  animationDelay,
  multiLine = false,
}: HeroHeadingProps) {
  const text = getHeadingText(heading);
  const lines = getHeadingLines(heading);
  const media = useMedia();

  // On mobile (below $gtSm breakpoint), skip animation and use responsive Tamagui Heading
  const isMobile = !media.gtSm;

  if (animationVariant === "fade-up" && !isMobile) {
    return <FadeUpText text={text} delay={animationDelay} style={headingStyle} />;
  }

  // Multi-line rendering for mobile
  if (multiLine && lines.length > 1) {
    return (
      <Column>
        {lines.map((line, index) => (
          <Heading
            key={index}
            level={1}
            fontSize={40}
            color="$text"
            fontWeight="700"
            lineHeight={46}
          >
            {line}
          </Heading>
        ))}
      </Column>
    );
  }

  // Default: no animation
  return (
    <Heading
      level={1}
      size="$7"
      lineHeight="$7"
      $gtSm={{ textAlign: "left", fontSize: "$9", lineHeight: "$9" }}
      $md={{ fontSize: "$11", lineHeight: "$11" }}
      $lg={{ fontSize: "$14", lineHeight: "$14" }}
      color="$text"
      fontWeight="700"
      textAlign="center"
      style={{ whiteSpace: "normal", wordBreak: "keep-all" }}
    >
      {text}
    </Heading>
  );
}

/**
 * Cross-platform Hero component for marketplace
 * Works on both web and React Native mobile
 * Uses Tamagui primitives for full compatibility
 */
export function Hero({
  heading,
  subtitle,
  primaryCta,
  secondaryCta,
  backgroundImage,
  heroImage,
  showHeroImage = true,
  minHeight = 500,
  maxHeight = 700,
  animationVariant = "none",
  animationDelay = 0.8,
}: Readonly<HeroProps>) {
  const heroImageSource = heroImage ? getImageSource(heroImage) : null;
  const HeroSvgComponent = heroImage ? getSvgComponent(heroImage) : null;
  const isWeb = Platform.OS === "web";
  const isMobile = !isWeb;

  // Mobile-specific layout
  if (isMobile) {
    return (
      <Column width="100%" paddingHorizontal="$4" paddingTop="$2" backgroundColor="$background">
        <View
          width="100%"
          height={minHeight}
          maxHeight={maxHeight}
          borderRadius="$2xl"
          overflow="hidden"
          position="relative"
        >
          {/* Background Image */}
          <Image
            source={images.hero.butterBackground}
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            objectFit="cover"
            opacity={0.7}
            zIndex={0}
          />

          {/* Content Container - Side by side layout */}
          <Row width="100%" height="100%" position="absolute" top={0} left={0} zIndex={1}>
            {/* Left Side - Text Content (55%) */}
            <Column width="55%" height="100%" justifyContent="center" paddingLeft="$4">
              <HeroHeading
                heading={heading}
                animationVariant="none"
                animationDelay={0}
                multiLine={true}
              />
            </Column>

            {/* Right Side - Hero Image (45%) */}
            {showHeroImage && (HeroSvgComponent || heroImageSource) && (
              <Column
                width="45%"
                flex={1}
                justifyContent="flex-end"
                alignItems="flex-end"
                overflow="visible"
              >
                {HeroSvgComponent ? (
                  <HeroSvgComponent width="100%" height="95%" />
                ) : heroImageSource ? (
                  <RNImage
                    source={heroImageSource as number}
                    style={{
                      width: minHeight * 0.95 * 1.68,
                      height: minHeight * 0.95,
                      marginRight: -95,
                      marginBottom: 0,
                    }}
                    resizeMode="contain"
                  />
                ) : null}
              </Column>
            )}
          </Row>
        </View>
      </Column>
    );
  }

  // Web/Desktop layout
  return (
    <Column
      width="100%"
      paddingHorizontal="$md"
      paddingTop="$md"
      backgroundColor="$background"
      alignItems="center"
    >
      <View
        width="100%"
        height={320}
        $gtSm={{ height: 350 }}
        $gtMd={{ height: 400, width: "80%" }}
        minHeight={minHeight}
        maxHeight={maxHeight}
        borderRadius="$2xl"
        position="relative"
      >
        {/* Background Container - Clipped for rounded corners */}
        <View
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          borderRadius="$2xl"
          overflow="hidden"
          zIndex={0}
        >
          {/* Background Image - with 70% opacity */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundImage: "url(/_assets/images/butter-background.webp)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: 0.7,
            }}
          />
        </View>

        {/* Content Container - NOT clipped, allows image overflow */}
        <Row width="100%" height="100%" position="relative" zIndex={1}>
          {/* Left Side - Text Content */}
          <Column
            width="100%"
            justifyContent="center"
            alignItems="center"
            paddingLeft="$6"
            paddingRight="$6"
            $gtSm={{
              width: "55%",
              paddingLeft: "$8",
              paddingRight: "$2",
              alignItems: "flex-start",
            }}
            $gtMd={{ width: "60%", paddingLeft: "$12", paddingRight: "$4" }}
          >
            <Column
              gap="$4"
              $gtSm={{ gap: "$5", maxWidth: 700 }}
              $gtMd={{ gap: "$6" }}
              width="100%"
            >
              {/* Heading */}
              <HeroHeading
                heading={heading}
                animationVariant={animationVariant}
                animationDelay={animationDelay}
              />

              {/* Subtitle */}
              {subtitle && (
                <Text
                  size="$7"
                  $gtSm={{ fontSize: "$8", textAlign: "left" }}
                  $md={{ fontSize: "$9" }}
                  color="$textSecondary"
                  fontWeight="500"
                  marginTop="$2"
                  textAlign="center"
                >
                  {subtitle}
                </Text>
              )}

              {/* CTA Buttons */}
              <HeroCTAButtons primaryCta={primaryCta} secondaryCta={secondaryCta} />
            </Column>
          </Column>

          {/* Right Side - Hero Image */}
          {showHeroImage && heroImageSource && <HeroImage source={heroImageSource} />}
        </Row>
      </View>
    </Column>
  );
}

interface HeroCTAButtonsProps {
  readonly primaryCta?: { label: string; href: string };
  readonly secondaryCta?: { label: string; href: string };
}

function HeroCTAButtons({ primaryCta, secondaryCta }: HeroCTAButtonsProps) {
  // Use solito's useLink hook for proper navigation
  const primaryLink = useLink({ href: primaryCta?.href ?? "/" });
  const secondaryLink = useLink({ href: secondaryCta?.href ?? "/" });

  if (!primaryCta && !secondaryCta) return null;

  return (
    <Row
      gap="$md"
      flexWrap="wrap"
      marginTop="$4"
      justifyContent="center"
      $gtSm={{ justifyContent: "flex-start" }}
    >
      {primaryCta && (
        <Button
          butterVariant="primary"
          size="$5"
          $gtSm={{ size: "$4" }}
          onPress={primaryLink.onPress}
          accessibilityRole="link"
        >
          {primaryCta.label}
        </Button>
      )}
      {secondaryCta && (
        <Button
          butterVariant="secondary"
          size="$5"
          $gtSm={{ size: "$4" }}
          onPress={secondaryLink.onPress}
          accessibilityRole="link"
        >
          {secondaryCta.label}
        </Button>
      )}
    </Row>
  );
}

interface HeroImageProps {
  readonly source: { uri: string } | number;
}

function HeroImage({ source }: HeroImageProps) {
  const isWeb = Platform.OS === "web";

  return (
    <Column
      display="none"
      width="45%"
      height="100%"
      backgroundColor="transparent"
      alignItems="center"
      justifyContent="flex-end"
      paddingRight="$4"
      $gtSm={{ display: "flex", width: "45%" }}
      $gtMd={{ width: "40%", paddingRight: "$8" }}
    >
      {isWeb ? (
        <img
          src={typeof source === "object" && "uri" in source ? source.uri : ""}
          alt="Premium golf club featured in hero section"
          style={{
            width: "auto",
            height: "90%",
            maxHeight: "100%",
            objectFit: "contain",
            objectPosition: "center bottom",
            marginBottom: 0,
          }}
        />
      ) : (
        <Image
          source={source as Parameters<typeof Image>[0]["source"]}
          width="100%"
          height="100%"
          objectFit="contain"
          marginBottom={0}
        />
      )}
    </Column>
  );
}
