"use client";

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
 * Mobile bottom navigation with 5 tabs: Home, Wishlist, Sell, Messages, Account.
 * Features curved top corners and drop shadow matching the top search bar.
 *
 * Color scheme:
 * - Active tab: $primary (orange)
 * - Inactive tab: $text (dark grey in light mode, white in dark mode)
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
          role="button"
          aria-label="Home"
          aria-selected={activeTab === "home"}
        >
          <Home
            size={24}
            color={activeTab === "home" ? "$primary" : "$text"}
          />
          <Text
            size="$2"
            color={activeTab === "home" ? "$primary" : "$text"}
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
          role="button"
          aria-label="Wishlist"
          aria-selected={activeTab === "wishlist"}
        >
          <Heart
            size={24}
            color={activeTab === "wishlist" ? "$primary" : "$text"}
          />
          <Text
            size="$2"
            color={activeTab === "wishlist" ? "$primary" : "$text"}
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
          role="button"
          aria-label="Sell"
          aria-selected={activeTab === "sell"}
        >
          <PlusCircle
            size={24}
            color={activeTab === "sell" ? "$primary" : "$text"}
          />
          <Text
            size="$2"
            color={activeTab === "sell" ? "$primary" : "$text"}
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
          role="button"
          aria-label="Messages"
          aria-selected={activeTab === "messages"}
        >
          <MessageCircle
            size={24}
            color={activeTab === "messages" ? "$primary" : "$text"}
          />
          <Text
            size="$2"
            color={activeTab === "messages" ? "$primary" : "$text"}
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
          role="button"
          aria-label={isAuthenticated ? "Account" : "Log in"}
          aria-selected={isUserTabActive}
        >
          <User
            size={24}
            color={isUserTabActive ? "$primary" : "$text"}
          />
          <Text
            size="$2"
            color={isUserTabActive ? "$primary" : "$text"}
            fontWeight={isUserTabActive ? "600" : "400"}
          >
            Account
          </Text>
        </Column>
      </Row>
    </Column>
  );
}
