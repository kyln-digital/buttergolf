"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { Column, Row, Text, Button, Badge, Container, ThemeSwitcher } from "@buttergolf/ui";
import { Avatar, Button as TamaguiButton } from "tamagui";
import {
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
  MessageCircle,
} from "@tamagui/lucide-icons";
import { AccountMenuItem } from "@buttergolf/app";
import { PayoutSetupWizard } from "./PayoutSetupWizard";

interface AccountHubClientProps {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly phone?: string | null;
    readonly imageUrl?: string | null;
    readonly hasConnectAccount: boolean;
    readonly onboardingComplete: boolean;
    readonly accountStatus: string;
  };
  /** Number of pending orders */
  readonly pendingOrdersCount?: number;
  /** Number of unread messages */
  readonly unreadMessagesCount?: number;
  /** Number of active listings */
  readonly activeListingsCount?: number;
}

/**
 * Account Hub Client Component
 * Main account management page mirroring mobile's AccountScreen design
 */
export function AccountHubClient({
  user,
  pendingOrdersCount = 0,
  unreadMessagesCount = 0,
  activeListingsCount = 0,
}: AccountHubClientProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const [showPayoutSetup, setShowPayoutSetup] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Use Clerk user's image if available
  const imageUrl = clerkUser?.imageUrl || user.imageUrl;

  // Generate initials for avatar fallback
  const getInitials = (): string => {
    const first = user.firstName?.charAt(0)?.toUpperCase() || "";
    const last = user.lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || user.email?.charAt(0)?.toUpperCase() || "?";
  };

  // Generate display name
  const getDisplayName = (): string => {
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(" ");
    }
    return "User";
  };

  const isSellerOnboarded =
    user.hasConnectAccount && user.onboardingComplete && user.accountStatus === "active";

  // Determine payout status badge
  const getPayoutStatusBadge = () => {
    if (user.accountStatus === "active") {
      return (
        <Badge variant="success" size="sm">
          Active
        </Badge>
      );
    }
    if (user.accountStatus === "restricted") {
      return (
        <Badge variant="warning" size="sm">
          Action Required
        </Badge>
      );
    }
    if (user.hasConnectAccount && user.onboardingComplete) {
      return (
        <Badge variant="info" size="sm">
          Pending
        </Badge>
      );
    }
    if (user.hasConnectAccount) {
      return (
        <Badge variant="warning" size="sm">
          Incomplete
        </Badge>
      );
    }
    return (
      <Badge variant="neutral" size="sm">
        Setup
      </Badge>
    );
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  const handlePayoutSetupComplete = () => {
    setShowPayoutSetup(false);
    globalThis.location.reload();
  };

  // Show payout setup wizard
  if (showPayoutSetup) {
    return (
      <Container size="lg" paddingHorizontal="$md" paddingVertical="$xl">
        <PayoutSetupWizard
          initialStatus={{
            hasAccount: user.hasConnectAccount,
            onboardingComplete: user.onboardingComplete,
            accountStatus: user.accountStatus,
            requirementsCount: 0,
            phone: user.phone ?? null,
          }}
          onComplete={handlePayoutSetupComplete}
          onExit={() => setShowPayoutSetup(false)}
        />
      </Container>
    );
  }

  return (
    <Container size="md" paddingHorizontal="$md" paddingVertical="$xl">
      <Column gap="$xl" width="100%">
        {/* Profile Header Card */}
        <TamaguiButton
          unstyled
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$5"
          pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.99 }}
          hoverStyle={{ backgroundColor: "$backgroundHover" }}
          onPress={() => {
            // Open Clerk user profile modal
            clerkUser?.update && router.push("/account/profile");
          }}
        >
          <Row alignItems="center" gap="$4">
            {/* Avatar */}
            <Avatar circular size="$10">
              {imageUrl ? (
                <Avatar.Image accessibilityLabel={getDisplayName()} src={imageUrl} />
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
              <Text size="$4" color="$textSecondary" numberOfLines={1}>
                {user.email}
              </Text>
            </Column>

            {/* Edit indicator */}
            <Edit3 size={20} color="$textMuted" />
          </Row>
        </TamaguiButton>

        {/* Shopping Section */}
        <Column gap="$3">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2">
            SHOPPING
          </Text>

          <AccountMenuItem
            icon={<ShoppingBag size={22} color="$primary" />}
            label="My Orders"
            description="View your purchase history"
            badge={pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
            badgeVariant="primary"
            onPress={() => router.push("/orders")}
          />

          <AccountMenuItem
            icon={<MessageCircle size={22} color="$info" />}
            label="Messages"
            description="Chat with buyers and sellers"
            badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
            badgeVariant="info"
            onPress={() => router.push("/messages")}
          />

          <AccountMenuItem
            icon={<Heart size={22} color="$error" />}
            label="Favourites"
            description="Your saved items"
            onPress={() => router.push("/favourites")}
          />
        </Column>

        {/* Selling Section */}
        <Column gap="$3">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2">
            SELLING
          </Text>

          <AccountMenuItem
            icon={<Store size={22} color={isSellerOnboarded ? "$success" : "$textSecondary"} />}
            label="Seller Dashboard"
            description={
              isSellerOnboarded ? "Manage your sales and listings" : "View your sales and listings"
            }
            badge={activeListingsCount > 0 ? activeListingsCount : undefined}
            badgeVariant="success"
            onPress={() => router.push("/seller")}
          />

          {/* Payout Setup */}
          <TamaguiButton
            unstyled
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
            hoverStyle={{ backgroundColor: "$backgroundHover" }}
            onPress={() => {
              if (isSellerOnboarded) {
                router.push("/seller/settings");
              } else {
                setShowPayoutSetup(true);
              }
            }}
          >
            <Row alignItems="center" gap="$3" flex={1}>
              <CreditCard size={22} color={isSellerOnboarded ? "$success" : "$warning"} />
              <Column flex={1} gap="$1">
                <Text size="$5" fontWeight="500" color="$text">
                  Payout Setup
                </Text>
                <Text size="$3" color="$textSecondary" numberOfLines={1}>
                  {isSellerOnboarded ? "Manage your payout settings" : "Set up to receive payments"}
                </Text>
              </Column>
              {getPayoutStatusBadge()}
            </Row>
          </TamaguiButton>
        </Column>

        {/* Account Section */}
        <Column gap="$3">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2">
            ACCOUNT
          </Text>

          <AccountMenuItem
            icon={<MapPin size={22} color="$info" />}
            label="Addresses"
            description="Manage shipping addresses"
            onPress={() => router.push("/account/addresses")}
          />

          <AccountMenuItem
            icon={<CreditCard size={22} color="$warning" />}
            label="Payment Methods"
            description="Manage payment options"
            onPress={() => router.push("/account/payment-methods")}
          />
        </Column>

        {/* Preferences Section */}
        <Column gap="$3">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2">
            PREFERENCES
          </Text>

          {/* Theme Switcher - inline */}
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
            onPress={() => router.push("/account/notifications")}
          />
        </Column>

        {/* Support Section */}
        <Column gap="$3">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2">
            SUPPORT
          </Text>

          <AccountMenuItem
            icon={<HelpCircle size={22} color="$text" />}
            label="Help & Support"
            description="FAQ and contact us"
            onPress={() => router.push("/help-centre")}
          />
        </Column>

        {/* Sign Out Button */}
        <Column paddingTop="$4" gap="$4">
          <Button
            size="$5"
            backgroundColor="$surface"
            borderWidth={1}
            borderColor="$error"
            onPress={handleSignOut}
            disabled={isSigningOut}
            width="100%"
          >
            <Row alignItems="center" gap="$2">
              <LogOut size={20} color="$error" />
              <Text color="$error" fontWeight="500">
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </Text>
            </Row>
          </Button>
        </Column>

        {/* Version info */}
        <Text size="$2" color="$textMuted" textAlign="center" marginTop="$4">
          ButterGolf v1.0.0
        </Text>
      </Column>
    </Container>
  );
}
