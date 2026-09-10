"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { Column, Row, Text, Heading, Button, Container, ThemeSwitcher } from "@buttergolf/ui";
import { Avatar } from "tamagui";
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
  MessageCircle,
} from "@tamagui/lucide-icons";
import { AccountMenuItem } from "@buttergolf/app";
import { useLinkPress } from "@/hooks/useLinkPress";
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

type PayoutBadge = {
  label: string;
  variant: "success" | "warning" | "info" | "neutral";
};

function SectionLabel({ children }: Readonly<{ children: string }>) {
  return (
    <Text size="$2" color="$textSecondary" fontWeight="600" paddingLeft="$xs">
      {children}
    </Text>
  );
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
  const linkPress = useLinkPress();
  const { signOut, openUserProfile } = useClerk();
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
  const getPayoutBadge = (): PayoutBadge => {
    if (user.accountStatus === "active") return { label: "Active", variant: "success" };
    if (user.accountStatus === "restricted")
      return { label: "Action required", variant: "warning" };
    if (user.hasConnectAccount && user.onboardingComplete)
      return { label: "Pending", variant: "info" };
    if (user.hasConnectAccount) return { label: "Incomplete", variant: "warning" };
    return { label: "Set up", variant: "neutral" };
  };
  const payoutBadge = getPayoutBadge();

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
    <Container size="md" paddingHorizontal="$md" paddingTop="$lg" paddingBottom="$3xl">
      <Column gap="$xl" width="100%">
        <Heading level={1} size="$8" color="$text">
          Account
        </Heading>

        {/* Profile */}
        <Row
          alignItems="center"
          gap="$md"
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$md"
        >
          <Avatar circular size="$7">
            {imageUrl ? (
              <Avatar.Image accessibilityLabel={getDisplayName()} src={imageUrl} />
            ) : (
              <Avatar.Fallback
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
              >
                <Text size="$6" color="$textInverse" fontWeight="600">
                  {getInitials()}
                </Text>
              </Avatar.Fallback>
            )}
          </Avatar>

          <Column flex={1} gap={2} minWidth={0}>
            <Text size="$6" fontWeight="600" color="$text">
              {getDisplayName()}
            </Text>
            <Text size="$4" color="$textSecondary" numberOfLines={1}>
              {user.email}
            </Text>
          </Column>

          {/* Clerk's hosted profile modal owns name, email and avatar edits */}
          <Button butterVariant="secondary" size="$3" onPress={() => openUserProfile()}>
            Manage
          </Button>
        </Row>

        {/* Shopping */}
        <Column gap="$sm">
          <SectionLabel>SHOPPING</SectionLabel>

          <AccountMenuItem
            icon={<ShoppingBag size={22} color="$text" />}
            label="Orders"
            description="View your purchase history"
            badge={pendingOrdersCount > 0 ? pendingOrdersCount : undefined}
            badgeVariant="primary"
            href="/orders"
            onPress={linkPress("/orders")}
          />

          <AccountMenuItem
            icon={<MessageCircle size={22} color="$text" />}
            label="Messages"
            description="Chat with buyers and sellers"
            badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
            badgeVariant="primary"
            href="/messages"
            onPress={linkPress("/messages")}
          />

          <AccountMenuItem
            icon={<Heart size={22} color="$text" />}
            label="Favourites"
            description="Your saved items"
            href="/favourites"
            onPress={linkPress("/favourites")}
          />
        </Column>

        {/* Selling */}
        <Column gap="$sm">
          <SectionLabel>SELLING</SectionLabel>

          <AccountMenuItem
            icon={<Store size={22} color="$text" />}
            label="Seller dashboard"
            description={
              isSellerOnboarded ? "Manage your sales and listings" : "View your sales and listings"
            }
            badge={activeListingsCount > 0 ? activeListingsCount : undefined}
            badgeVariant="neutral"
            href="/seller"
            onPress={linkPress("/seller")}
          />

          {isSellerOnboarded ? (
            <AccountMenuItem
              icon={<CreditCard size={22} color="$text" />}
              label="Payout setup"
              description="Manage your payout settings"
              badge={payoutBadge.label}
              badgeVariant={payoutBadge.variant}
              href="/seller/settings"
              onPress={linkPress("/seller/settings")}
            />
          ) : (
            <AccountMenuItem
              icon={<CreditCard size={22} color="$text" />}
              label="Payout setup"
              description="Set up to receive payments"
              badge={payoutBadge.label}
              badgeVariant={payoutBadge.variant}
              onPress={() => setShowPayoutSetup(true)}
            />
          )}
        </Column>

        {/* Account */}
        <Column gap="$sm">
          <SectionLabel>ACCOUNT</SectionLabel>

          <AccountMenuItem
            icon={<MapPin size={22} color="$text" />}
            label="Addresses"
            description="Manage shipping addresses"
            href="/account/addresses"
            onPress={linkPress("/account/addresses")}
          />

          <AccountMenuItem
            icon={<CreditCard size={22} color="$text" />}
            label="Payment methods"
            description="Manage payment options"
            href="/account/payment-methods"
            onPress={linkPress("/account/payment-methods")}
          />
        </Column>

        {/* Preferences */}
        <Column gap="$sm">
          <SectionLabel>PREFERENCES</SectionLabel>

          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$md"
            gap="$sm"
          >
            <Row alignItems="center" gap="$sm">
              <Palette size={22} color="$text" />
              <Text size="$5" fontWeight="600" color="$text">
                Appearance
              </Text>
            </Row>
            <ThemeSwitcher showLabels />
          </Column>

          <AccountMenuItem
            icon={<Bell size={22} color="$text" />}
            label="Notifications"
            description="Manage notification preferences"
            href="/account/notifications"
            onPress={linkPress("/account/notifications")}
          />
        </Column>

        {/* Support */}
        <Column gap="$sm">
          <SectionLabel>SUPPORT</SectionLabel>

          <AccountMenuItem
            icon={<HelpCircle size={22} color="$text" />}
            label="Help & support"
            description="FAQ and contact us"
            href="/help-centre"
            onPress={linkPress("/help-centre")}
          />
        </Column>

        {/* Sign out */}
        <Column paddingTop="$sm" gap="$md">
          <Button
            butterVariant="secondary"
            size="$5"
            color="$error"
            icon={LogOut}
            onPress={handleSignOut}
            disabled={isSigningOut}
            width="100%"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </Column>

        {/* Version info */}
        <Text size="$2" color="$textSecondary" textAlign="center">
          ButterGolf v1.0.0
        </Text>
      </Column>
    </Container>
  );
}
