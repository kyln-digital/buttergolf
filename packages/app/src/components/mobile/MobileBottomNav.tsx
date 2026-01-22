"use client";

import React from "react";
import { Row, Column, Text } from "@buttergolf/ui";
import {
  Home,
  Heart,
  PlusCircle,
  MessageCircle,
  User,
} from "@tamagui/lucide-icons";

export interface MobileBottomNavProps {
  activeTab?: "home" | "wishlist" | "sell" | "messages" | "login" | "account";
  onHomePress?: () => void;
  onWishlistPress?: () => void;
  onSellPress?: () => void;
  onMessagesPress?: () => void;
  onLoginPress?: () => void;
  onAccountPress?: () => void;
  isAuthenticated?: boolean;
}

/**
 * Mobile bottom navigation with 5 tabs: Home, Wishlist, Sell, Messages, Login.
 * Features curved top corners and drop shadow matching the top search bar.
 */
export function MobileBottomNav({
  activeTab = "home",
  onHomePress,
  onWishlistPress,
  onSellPress,
  onMessagesPress,
  onLoginPress,
  onAccountPress,
  isAuthenticated = false,
}: Readonly<MobileBottomNavProps>) {
  const inactiveOpacity = 0.55;
  const activeOpacity = 1;

  // Determine if the user/account tab is active
  const isUserTabActive = isAuthenticated
    ? activeTab === "account"
    : activeTab === "login";
  return (
    <Column
      backgroundColor="$surface"
      borderTopLeftRadius="$2xl"
      borderTopRightRadius="$2xl"
      shadowColor="rgba(0, 0, 0, 0.15)"
      shadowOffset={{ width: 0, height: -4 }}
      shadowOpacity={1}
      shadowRadius={8}
      elevation={8}
      paddingTop="$3"
      paddingBottom="$6"
    >
      <Row
        alignItems="center"
        justifyContent="space-around"
        paddingHorizontal="$4"
      >
        {/* Home */}
        <Column
          gap="$1"
          alignItems="center"
          minWidth={60}
          paddingVertical="$2"
          paddingHorizontal="$2"
          onPress={onHomePress}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel="Home"
          accessibilityState={{ selected: activeTab === "home" }}
        >
          <Home
            size={24}
            color="$primary"
            opacity={activeTab === "home" ? activeOpacity : inactiveOpacity}
          />
          <Text
            fontSize={11}
            color="$primary"
            opacity={activeTab === "home" ? activeOpacity : inactiveOpacity}
            fontWeight={activeTab === "home" ? "600" : "400"}
          >
            Home
          </Text>
        </Column>

        {/* Wishlist */}
        <Column
          gap="$1"
          alignItems="center"
          minWidth={60}
          paddingVertical="$2"
          paddingHorizontal="$2"
          onPress={onWishlistPress}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel="Wishlist"
          accessibilityState={{ selected: activeTab === "wishlist" }}
        >
          <Heart
            size={24}
            color="$primary"
            opacity={activeTab === "wishlist" ? activeOpacity : inactiveOpacity}
          />
          <Text
            fontSize={11}
            color="$primary"
            opacity={activeTab === "wishlist" ? activeOpacity : inactiveOpacity}
            fontWeight={activeTab === "wishlist" ? "600" : "400"}
          >
            Wishlist
          </Text>
        </Column>

        {/* Sell */}
        <Column
          gap="$1"
          alignItems="center"
          minWidth={60}
          paddingVertical="$2"
          paddingHorizontal="$2"
          onPress={onSellPress}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel="Sell"
          accessibilityState={{ selected: activeTab === "sell" }}
        >
          <PlusCircle
            size={24}
            color="$primary"
            opacity={activeTab === "sell" ? activeOpacity : inactiveOpacity}
          />
          <Text
            fontSize={11}
            color="$primary"
            opacity={activeTab === "sell" ? activeOpacity : inactiveOpacity}
            fontWeight={activeTab === "sell" ? "600" : "400"}
          >
            Sell
          </Text>
        </Column>

        {/* Messages */}
        <Column
          gap="$1"
          alignItems="center"
          minWidth={60}
          paddingVertical="$2"
          paddingHorizontal="$2"
          onPress={onMessagesPress}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel="Messages"
          accessibilityState={{ selected: activeTab === "messages" }}
        >
          <MessageCircle
            size={24}
            color="$primary"
            opacity={activeTab === "messages" ? activeOpacity : inactiveOpacity}
          />
          <Text
            fontSize={11}
            color="$primary"
            opacity={activeTab === "messages" ? activeOpacity : inactiveOpacity}
            fontWeight={activeTab === "messages" ? "600" : "400"}
          >
            Messages
          </Text>
        </Column>

        {/* Login / Account - Conditional based on auth state */}
        <Column
          gap="$1"
          alignItems="center"
          minWidth={60}
          paddingVertical="$2"
          paddingHorizontal="$2"
          onPress={isAuthenticated ? onAccountPress : onLoginPress}
          cursor="pointer"
          accessibilityRole="button"
          accessibilityLabel={isAuthenticated ? "Account" : "Log in"}
          accessibilityState={{ selected: isUserTabActive }}
        >
          <User
            size={24}
            color="$primary"
            opacity={isUserTabActive ? activeOpacity : inactiveOpacity}
          />
          <Text
            fontSize={11}
            color="$primary"
            opacity={isUserTabActive ? activeOpacity : inactiveOpacity}
            fontWeight={isUserTabActive ? "600" : "400"}
          >
            {isAuthenticated ? "Account" : "Account"}
          </Text>
        </Column>
      </Row>
    </Column>
  );
}
