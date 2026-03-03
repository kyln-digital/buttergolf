"use client";

import React from "react";
import {
  Column,
  Row,
  ScrollView,
  Text,
  Button,
  Button as TamaguiButton,
  Heading,
  ThemeSwitcher,
} from "@buttergolf/ui";
import { Avatar } from "tamagui";
import {
  ArrowLeft,
  LogOut,
  Palette,
  ShoppingBag,
  Store,
  Heart,
  MapPin,
  CreditCard,
  Bell,
  HelpCircle,
  Edit3,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountMenuItem } from "./components";

interface UserData {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  imageUrl?: string | null;
}

export interface AccountScreenProps {
  user: UserData | null;
  isLoading?: boolean;
  /** Whether user has completed Stripe seller onboarding */
  isSellerOnboarded?: boolean;
  /** Number of items user has listed for sale */
  activeListingsCount?: number;
  /** Number of pending payouts (sales waiting for payout setup) */
  pendingPayoutsCount?: number;
  /** Number of pending orders (purchases) */
  pendingOrdersCount?: number;
  /** Number of unread messages */
  unreadMessagesCount?: number;
  onSignOut?: () => void;
  onNavigateBack?: () => void;
  /** Navigate to profile edit screen */
  onEditProfile?: () => void;
  /** Navigate to My Orders list */
  onViewOrders?: () => void;
  /** Navigate to My Sales / Seller Dashboard */
  onViewSellerDashboard?: () => void;
  /** Navigate to Favourites */
  onViewFavourites?: () => void;
  /** Navigate to Addresses */
  onViewAddresses?: () => void;
  /** Navigate to Payment Methods */
  onViewPayments?: () => void;
  /** Navigate to Notification Settings */
  onViewNotifications?: () => void;
  /** Navigate to Help & Support */
  onViewHelp?: () => void;
  /** Start seller onboarding if not completed */
  onStartSellerOnboarding?: () => void;
}

/**
 * Account screen displaying user profile and navigation menu.
 * Serves as the main hub for account management.
 */
export function AccountScreen({
  user,
  isLoading = false,
  isSellerOnboarded = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeListingsCount,
  pendingPayoutsCount,
  pendingOrdersCount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  unreadMessagesCount,
  onSignOut,
  onNavigateBack,
  onEditProfile,
  onViewOrders,
  onViewSellerDashboard,
  onViewFavourites,
  onViewAddresses,
  onViewPayments,
  onViewNotifications,
  onViewHelp,
  onStartSellerOnboarding,
}: Readonly<AccountScreenProps>) {
  const insets = useSafeAreaInsets();

  // Generate initials for avatar fallback
  const getInitials = (): string => {
    if (!user) return "?";
    const first = user.firstName?.charAt(0)?.toUpperCase() || "";
    const last = user.lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || user.email?.charAt(0)?.toUpperCase() || "?";
  };

  // Generate display name
  const getDisplayName = (): string => {
    if (!user) return "User";
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(" ");
    }
    return "User";
  };

  return (
    <Column flex={1} backgroundColor="$background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
      >
        {/* Header with back button */}
        {onNavigateBack && (
          <Row alignItems="center" marginBottom="$4">
            <TamaguiButton
              chromeless
              circular
              size="$4"
              onPress={onNavigateBack}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color="$text" />
            </TamaguiButton>
            <Heading level={3} marginLeft="$2">
              Account
            </Heading>
          </Row>
        )}

        {/* Profile Header Card */}
        <TamaguiButton
          unstyled
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          marginBottom="$6"
          pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
          onPress={onEditProfile}
        >
          <Row alignItems="center" gap="$4">
            {/* Avatar */}
            <Avatar circular size="$10">
              {user?.imageUrl ? (
                <Avatar.Image accessibilityLabel={getDisplayName()} src={user.imageUrl} />
              ) : (
                <Avatar.Fallback
                  backgroundColor="$primary"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text size="$7" color="$textInverse" fontWeight="600">
                    {getInitials()}
                  </Text>
                </Avatar.Fallback>
              )}
            </Avatar>

            {/* Name and Email */}
            <Column flex={1} gap="$1">
              <Text size="$6" fontWeight="600" color="$text">
                {getDisplayName()}
              </Text>
              {user?.email && (
                <Text size="$4" color="$textSecondary" numberOfLines={1}>
                  {user.email}
                </Text>
              )}
            </Column>

            {/* Edit indicator */}
            {onEditProfile && <Edit3 size={20} color="$textMuted" />}
          </Row>
        </TamaguiButton>

        {/* Shopping Section */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            SHOPPING
          </Text>

          <AccountMenuItem
            icon={<ShoppingBag size={22} color="$primary" />}
            label="My Orders"
            description="View your purchase history"
            badge={pendingOrdersCount && pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
            badgeVariant="primary"
            onPress={onViewOrders}
          />

          <AccountMenuItem
            icon={<Heart size={22} color="$error" />}
            label="Favourites"
            description="Your saved items"
            onPress={onViewFavourites}
          />
        </Column>

        {/* Selling Section */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            SELLING
          </Text>

          {/* My Sales - always visible */}
          <AccountMenuItem
            icon={<Store size={22} color={isSellerOnboarded ? "$success" : "$textSecondary"} />}
            label="My Sales"
            description={
              isSellerOnboarded ? "Manage your sales and listings" : "View your sales and listings"
            }
            badge={
              !isSellerOnboarded && pendingPayoutsCount && pendingPayoutsCount > 0
                ? pendingPayoutsCount
                : undefined
            }
            badgeVariant={!isSellerOnboarded ? "warning" : "primary"}
            onPress={onViewSellerDashboard}
          />

          {/* Payout Setup - shown if not onboarded */}
          {!isSellerOnboarded && (
            <AccountMenuItem
              icon={<CreditCard size={22} color="$warning" />}
              label="Payout Setup"
              description="Set up to receive payments"
              badge={pendingPayoutsCount && pendingPayoutsCount > 0 ? "Required" : "Setup"}
              badgeVariant="warning"
              onPress={onStartSellerOnboarding}
            />
          )}
        </Column>

        {/* Account Section */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            ACCOUNT
          </Text>

          <AccountMenuItem
            icon={<MapPin size={22} color="$secondary" />}
            label="Addresses"
            description="Manage shipping addresses"
            onPress={onViewAddresses}
          />

          <AccountMenuItem
            icon={<CreditCard size={22} color="$warning" />}
            label="Payment Methods"
            description="Manage payment options"
            onPress={onViewPayments}
          />
        </Column>

        {/* Preferences Section */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            PREFERENCES
          </Text>

          {/* Theme Switcher */}
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            gap="$3"
          >
            <Row alignItems="center" gap="$2">
              <Palette size={22} color="$text" />
              <Text size="$5" fontWeight="500" color="$text">
                Appearance
              </Text>
            </Row>
            <ThemeSwitcher showLabels />
          </Column>

          <AccountMenuItem
            icon={<Bell size={22} color="$text" />}
            label="Notifications"
            description="Manage notification preferences"
            onPress={onViewNotifications}
          />
        </Column>

        {/* Support Section */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            SUPPORT
          </Text>

          <AccountMenuItem
            icon={<HelpCircle size={22} color="$text" />}
            label="Help & Support"
            description="FAQ and contact us"
            onPress={onViewHelp}
          />
        </Column>

        {/* Sign Out Button */}
        <Column paddingTop="$2" gap="$4">
          <Button
            size="$5"
            backgroundColor="$surface"
            borderWidth={1}
            borderColor="$error"
            onPress={onSignOut}
            disabled={isLoading}
            icon={<LogOut size={20} color="$error" />}
          >
            <Text color="$error" fontWeight="500">
              Sign Out
            </Text>
          </Button>
        </Column>

        {/* Version info */}
        <Text size="$2" color="$textMuted" textAlign="center" marginTop="$6">
          ButterGolf v1.0.0
        </Text>
      </ScrollView>
    </Column>
  );
}
