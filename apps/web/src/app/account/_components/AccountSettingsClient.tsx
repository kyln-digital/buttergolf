"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Card, Badge, Container } from "@buttergolf/ui";
import { SellerOnboarding } from "../../_components/SellerOnboarding";

interface AccountSettingsClientProps {
  readonly user: {
    readonly email: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly hasConnectAccount: boolean;
    readonly onboardingComplete: boolean;
    readonly accountStatus: string;
  };
}

/**
 * Client component for account settings page
 * Handles seller onboarding state and UI interactions
 */
export function AccountSettingsClient({ user }: AccountSettingsClientProps) {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Determine badge variant based on account status
  const getStatusBadge = () => {
    switch (user.accountStatus) {
      case "active":
        return (
          <Badge variant="success" size="md">
            Active Seller
          </Badge>
        );
      case "restricted":
        return (
          <Badge variant="warning" size="md">
            Restricted
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="info" size="md">
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Refresh the page to show updated status
    globalThis.location.reload();
  };

  const renderContent = () => {
    if (user.hasConnectAccount && user.onboardingComplete && user.accountStatus === "active") {
      return (
        <>
          <Text color="$textSecondary">
            Your seller account is active and ready to receive payments. You can now list products
            and manage your sales.
          </Text>
          <Row gap="$md">
            <Button butterVariant="primary" size="$4" onPress={() => router.push("/seller")}>
              View Seller Dashboard
            </Button>
            <Button
              size="$4"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$border"
              onPress={() => router.push("/seller/settings")}
            >
              Account Settings
            </Button>
          </Row>
        </>
      );
    }

    if (user.hasConnectAccount && user.onboardingComplete && user.accountStatus === "restricted") {
      return (
        <>
          <Text color="$textSecondary">
            Your seller account has some restrictions. Please update your account information to
            enable full functionality.
          </Text>
          <Row gap="$md">
            <Button
              butterVariant="primary"
              size="$4"
              onPress={() => router.push("/seller/settings")}
            >
              Resolve Issues
            </Button>
            <Button
              size="$4"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$border"
              onPress={() => router.push("/seller")}
            >
              View Dashboard
            </Button>
          </Row>
        </>
      );
    }

    if (user.hasConnectAccount && user.onboardingComplete) {
      return (
        <>
          <Text color="$textSecondary">
            Your seller account is being reviewed. This usually takes 1-2 business days.
          </Text>
          <Row gap="$md">
            <Button butterVariant="primary" size="$4" onPress={() => router.push("/seller")}>
              View Dashboard
            </Button>
            <Button
              size="$4"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$border"
              onPress={() => router.push("/seller/settings")}
            >
              View Status
            </Button>
          </Row>
        </>
      );
    }

    if (user.hasConnectAccount) {
      return (
        <>
          <Text color="$textSecondary">
            Your seller account setup is incomplete. Please complete the onboarding process to start
            selling.
          </Text>
          <Row gap="$md">
            <Button size="$4" onPress={() => setShowOnboarding(true)}>
              Continue Onboarding
            </Button>
          </Row>
        </>
      );
    }

    return (
      <>
        <Text color="$textSecondary">
          Start selling golf equipment on ButterGolf. Complete the quick onboarding process to set
          up your seller account and begin listing products.
        </Text>
        <Row>
          <Button size="$5" onPress={() => setShowOnboarding(true)}>
            Become a Seller
          </Button>
        </Row>
      </>
    );
  };

  if (showOnboarding) {
    return (
      <Container size="lg" paddingHorizontal="$md">
        <Card variant="elevated" padding="$lg">
          <SellerOnboarding
            onComplete={handleOnboardingComplete}
            onExit={() => setShowOnboarding(false)}
          />
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg" paddingHorizontal="$md">
      <Column gap="$xl" fullWidth>
        <Column gap="$sm">
          <Heading level={1}>Account Settings</Heading>
          <Text color="$textSecondary">Manage your account and seller settings</Text>
        </Column>

        {/* Account Info Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$md">
            <Heading level={3}>Account Information</Heading>
            <Column gap="$xs">
              <Text weight="medium">Email</Text>
              <Text color="$textSecondary">{user.email}</Text>
            </Column>
            {(user.firstName || user.lastName) && (
              <Column gap="$xs">
                <Text weight="medium">Name</Text>
                <Text color="$textSecondary">
                  {`${user.firstName || ""} ${user.lastName || ""}`.trim()}
                </Text>
              </Column>
            )}
          </Column>
        </Card>

        {/* Seller Status Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$lg">
            <Row alignItems="center" justifyContent="space-between">
              <Heading level={3}>Seller Account</Heading>
              {getStatusBadge()}
            </Row>
            {renderContent()}
          </Column>
        </Card>
      </Column>
    </Container>
  );
}
