"use client";

import React, { useEffect, useMemo } from "react";
import {
  Dimensions,
  Animated,
  Easing,
  Text as RNText,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { Text, YStack, View, Image, Button, useTheme } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Logo variants for light/dark mode
const LogoOrangeSvg =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../../../../apps/mobile/assets/logo-orange-on-white.svg").default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LogoCreamPng = require("../../../../../apps/mobile/assets/logo-cream.png");

const { width: SCREEN_W } = Dimensions.get("window");

// Two-row scrolling layout configuration
const HORIZONTAL_PADDING = 16;
const { height: SCREEN_H } = Dimensions.get("window");
const CAROUSEL_HEIGHT = SCREEN_H * 0.32; // 32% of screen height
const CARD_HEIGHT = CAROUSEL_HEIGHT * 0.46; // Each row is ~46% of carousel height
const CARD_WIDTH = CARD_HEIGHT * 1.5; // 3:2 aspect ratio to match image dimensions (1536×1024)
const GAP = 12; // Gap between cards

// Top row images: image.png, image2.png, image4.png, image6.png
const topRowImages = [
  {
    id: "top-0",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image.png"),
    label: "Premium Golf Club",
  },
  {
    id: "top-2",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image2.png"),
    label: "Premium Golf Club",
  },
  {
    id: "top-4",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image4.png"),
    label: "Premium Golf Club",
  },
  {
    id: "top-6",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image6.png"),
    label: "Premium Golf Club",
  },
];

// Bottom row images: image1.png, image3.png, image5.png, image7.png
const bottomRowImages = [
  {
    id: "bottom-1",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image1.png"),
    label: "Premium Golf Club",
  },
  {
    id: "bottom-3",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image3.png"),
    label: "Premium Golf Club",
  },
  {
    id: "bottom-5",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image5.png"),
    label: "Premium Golf Club",
  },
  {
    id: "bottom-7",
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require("../../../../../apps/mobile/assets/branded_clubs/image7.png"),
    label: "Premium Golf Club",
  },
];

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAbout: _onAbout,
}: Readonly<OnboardingScreenProps>) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Get theme-aware text color for RNText
  const textSecondaryColor = isDark ? "#FFFAD2" : (theme.textSecondary?.val ?? "#545454");

  // Theme-aware colors
  const backgroundColor = isDark ? "$primary" : "$vanillaCream";
  const cardBackgroundColor = isDark ? "#D9450F" : "#FFFAD2"; // primaryHover for dark, vanillaCream for light
  const textColor = isDark ? "$vanillaCream" : "$text";

  // Animation for two-row horizontal scroll
  // Top row scrolls left, bottom row scrolls right for staggered effect
  // useMemo ensures a stable Animated.Value instance across renders (avoids ref-during-render lint warning)
  const topRowX = useMemo(() => new Animated.Value(0), []);
  const bottomRowX = useMemo(() => new Animated.Value(0), []);

  // Calculate total width of one set of images for each row
  const topRowWidth = topRowImages.length * (CARD_WIDTH + GAP);
  const bottomRowWidth = bottomRowImages.length * (CARD_WIDTH + GAP);

  useEffect(() => {
    // Duration for smooth scrolling
    const duration = 35000; // 35 seconds for full loop

    // Top row scrolls left
    const topAnimation = Animated.loop(
      Animated.timing(topRowX, {
        toValue: -topRowWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Bottom row scrolls right (starts offset for stagger effect)
    const bottomAnimation = Animated.loop(
      Animated.timing(bottomRowX, {
        toValue: bottomRowWidth,
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
  }, [topRowX, bottomRowX, topRowWidth, bottomRowWidth]);

  return (
    <YStack
      flex={1}
      backgroundColor={backgroundColor}
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
          {isDark ? (
            <Image
              source={LogoCreamPng}
              width="100%"
              height="100%"
              resizeMode="contain"
              accessible={true}
              accessibilityLabel="Butter Golf Logo"
            />
          ) : (
            <LogoOrangeSvg
              width="100%"
              height="100%"
              accessible={true}
              accessibilityLabel="Butter Golf Logo"
            />
          )}
        </View>

        {/* Tagline */}
        <YStack gap={4} alignItems="center">
          {/* eslint-disable-next-line react/forbid-component-props */}
          <Text fontSize={25} fontWeight="500" align="center" color={textColor} lineHeight={32}>
            The Marketplace to
          </Text>
          {/* eslint-disable-next-line react/forbid-component-props */}
          <Text fontSize={25} fontWeight="500" align="center" color={textColor} lineHeight={32}>
            Buy, Sell & Upgrade
          </Text>
        </YStack>
      </YStack>

      {/* Scrolling Carousel - Two Rows Staggered */}
      {/* marginTop reduced from 12 to 8 to tighten visual gap between header and carousel on mobile */}
      <View height={CAROUSEL_HEIGHT} overflow="hidden" marginTop={8} marginBottom={32}>
        {/* Top Row - Scrolls Left */}
        <Animated.View
          style={{
            flexDirection: "row",
            height: CARD_HEIGHT,
            marginBottom: GAP, // Gap between rows matches card gap
            transform: [{ translateX: topRowX }],
          }}
        >
          {topRowImages.concat(topRowImages).map((item, index) => (
            <View
              key={`${item.id}-${index}`}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              marginRight={GAP}
              borderRadius={20}
              overflow="hidden"
              style={{
                backgroundColor: cardBackgroundColor,
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
          {bottomRowImages.concat(bottomRowImages).map((item, index) => (
            <View
              key={`${item.id}-${index}`}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              marginLeft={GAP}
              borderRadius={20}
              overflow="hidden"
              style={{
                backgroundColor: cardBackgroundColor,
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
          {/* Primary Button - Pill-shaped, theme-aware */}
          {/* In light mode: use butterVariant="primary" (orange bg, white text) */}
          {/* In dark mode: override with cream bg, orange text */}
          <Button
            butterVariant={isDark ? undefined : "primary"}
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
            {...(isDark && {
              backgroundColor: "$vanillaCream",
              color: "$primary",
            })}
          >
            Create account
          </Button>

          {/* Secondary Button - Pill-shaped, theme-aware colors */}
          <Button
            size="$4"
            backgroundColor={isDark ? "transparent" : "$vanillaCream"}
            color={isDark ? "$vanillaCream" : "$primary"}
            borderWidth={2}
            borderColor={isDark ? "$vanillaCream" : "$primary"}
            borderRadius="$full"
            paddingHorizontal="$6"
            paddingVertical="$2"
            width="100%"
            onPress={onSignIn}
            pressStyle={{
              scale: 0.98,
              backgroundColor: isDark ? "rgba(255, 250, 210, 0.1)" : "$vanillaCreamHover",
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
