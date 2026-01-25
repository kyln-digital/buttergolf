"use client";

import React, { useEffect, useRef } from "react";
import { Dimensions, Animated, Easing, Text as RNText, TouchableOpacity } from "react-native";
import { Text, YStack, View, Image, Button, useTheme } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Logo - Using SVG
const LogoSvg =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../../../../apps/mobile/assets/logo-orange-on-white.svg").default;

const { width: SCREEN_W } = Dimensions.get("window");

// Two-row scrolling layout configuration
const HORIZONTAL_PADDING = 16;
const { height: SCREEN_H } = Dimensions.get("window");
const CAROUSEL_HEIGHT = SCREEN_H * 0.32; // 32% of screen height
const CARD_HEIGHT = CAROUSEL_HEIGHT * 0.46; // Each row is ~46% of carousel height
const CARD_WIDTH = CARD_HEIGHT * 1.5; // 3:2 aspect ratio to match image dimensions (1536×1024)
const GAP = 12; // Gap between cards

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// Branded club images - premium golf equipment photos
const brandedClubImages = [
  {
    id: "branded-0",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-1",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image1.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-2",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image2.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-3",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image3.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-4",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image4.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-5",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image5.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-6",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image6.png"),
    label: "Premium Golf Club",
  },
  {
    id: "branded-7",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image7.png"),
    label: "Premium Golf Club",
  },
];

// Shuffle images once at module load for random order
const carouselImages = shuffleArray(brandedClubImages);

interface OnboardingScreenProps {
  onSkip?: () => void;
  onSignUp?: () => void;
  onSignIn?: () => void;
  onAbout?: () => void;
}

export function OnboardingScreen({
  onSkip,
  onSignUp,
  onSignIn,
  onAbout,
}: Readonly<OnboardingScreenProps>) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  // Get theme-aware text color for RNText
  const textSecondaryColor = theme.textSecondary?.val ?? "#545454";

  // Animation for two-row horizontal scroll
  // Top row scrolls left, bottom row scrolls right for staggered effect
  const topRowX = useRef(new Animated.Value(0)).current;
  const bottomRowX = useRef(new Animated.Value(0)).current;

  // Duplicate images for seamless loop
  const loopedImages = [...carouselImages, ...carouselImages];

  // Calculate total width of one set of images
  const singleWidth = carouselImages.length * (CARD_WIDTH + GAP);

  useEffect(() => {
    // Duration for smooth scrolling
    const duration = 35000; // 35 seconds for full loop

    // Top row scrolls left
    const topAnimation = Animated.loop(
      Animated.timing(topRowX, {
        toValue: -singleWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Bottom row scrolls right (starts offset for stagger effect)
    const bottomAnimation = Animated.loop(
      Animated.timing(bottomRowX, {
        toValue: singleWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    topAnimation.start();
    bottomAnimation.start();

    return () => {
      topAnimation.stop();
      bottomAnimation.stop();
    };
  }, [topRowX, bottomRowX, singleWidth]);

  return (
    <YStack
      flex={1}
      backgroundColor="$vanillaCream" // Vanilla Cream background
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      {/* Header Section - Logo and Tagline */}
      <YStack
        paddingHorizontal={HORIZONTAL_PADDING}
        paddingTop={24}
        paddingBottom={24}
        alignItems="center"
        gap={20}
      >
        {/* Logo - Scaled to ~50% screen width */}
        <View width={SCREEN_W * 0.5} height={Math.round(SCREEN_W * 0.5 * (79 / 209))}>
          <LogoSvg
            width="100%"
            height="100%"
            accessible={true}
            accessibilityLabel="Butter Golf Logo"
          />
        </View>

        {/* Tagline */}
        <YStack gap={4} alignItems="center">
          <Text fontSize={25} fontWeight="500" align="center" color="$text" lineHeight={32}>
            The Marketplace to
          </Text>
          <Text fontSize={25} fontWeight="500" align="center" color="$text" lineHeight={32}>
            Buy, Sell & Upgrade
          </Text>
        </YStack>
      </YStack>

      {/* Scrolling Carousel - Two Rows Staggered */}
      <View height={CAROUSEL_HEIGHT} overflow="hidden" marginTop={12} marginBottom={32}>
        {/* Top Row - Scrolls Left */}
        <Animated.View
          style={{
            flexDirection: "row",
            height: CARD_HEIGHT,
            marginBottom: GAP, // Gap between rows matches card gap
            transform: [{ translateX: topRowX }],
          }}
        >
          {carouselImages.concat(carouselImages).map((item, index) => (
            <View
              key={`top-${item.id}-${index}`}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              marginRight={GAP}
              borderRadius={20}
              overflow="hidden"
              backgroundColor="$vanillaCream"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Image
                source={item.source}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                resizeMode="contain"
                accessible={true}
                accessibilityLabel={item.label}
              />
            </View>
          ))}
        </Animated.View>

        {/* Bottom Row - Scrolls Right (reverse direction) */}
        <Animated.View
          style={{
            flexDirection: "row-reverse",
            height: CARD_HEIGHT,
            transform: [{ translateX: bottomRowX }],
          }}
        >
          {carouselImages.concat(carouselImages).map((item, index) => (
            <View
              key={`bottom-${item.id}-${index}`}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              marginLeft={GAP}
              borderRadius={20}
              overflow="hidden"
              backgroundColor="$vanillaCream"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Image
                source={item.source}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                resizeMode="contain"
                accessible={true}
                accessibilityLabel={item.label}
              />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Content Section - Use flex to push to bottom */}
      <YStack
        flex={1}
        gap={24}
        paddingHorizontal={HORIZONTAL_PADDING}
        paddingBottom={24}
        alignItems="center"
        justifyContent="flex-end"
      >
        {/* CTAs - Design System Buttons */}
        <YStack gap={12} width="100%" paddingHorizontal={24}>
          {/* Primary Button - Pill-shaped with Spiced Clementine */}
          <Button
            butterVariant="primary"
            size="$4"
            borderRadius="$full"
            paddingHorizontal="$6"
            paddingVertical="$2"
            width="100%"
            onPress={onSignUp}
            pressStyle={{
              scale: 0.98,
              opacity: 0.9,
            }}
          >
            Create account
          </Button>

          {/* Secondary Button - Pill-shaped with Vanilla Cream background */}
          <Button
            size="$4"
            backgroundColor="$vanillaCream"
            color="$primary"
            borderWidth={2}
            borderColor="$primary"
            borderRadius="$full"
            paddingHorizontal="$6"
            paddingVertical="$2"
            width="100%"
            onPress={onSignIn}
            pressStyle={{
              scale: 0.98,
              backgroundColor: "$vanillaCreamHover",
            }}
          >
            I already have an account
          </Button>
        </YStack>

        {/* Skip Button - Navigate to Home */}
        <TouchableOpacity onPress={onSkip} style={{ paddingVertical: 12, paddingHorizontal: 24 }}>
          <RNText
            style={{
              color: textSecondaryColor,
              fontSize: 16,
              textAlign: "center",
              textDecorationLine: "underline",
            }}
          >
            Skip for now
          </RNText>
        </TouchableOpacity>
      </YStack>
    </YStack>
  );
}
