"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Card, Badge, Container } from "@buttergolf/ui";
import { PayoutSetupWizard } from "./PayoutSetupWizard";

interface AccountSettingsClientProps {
  readonly user: {
    readonly email: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly phone?: string | null;
    readonly hasConnectAccount: boolean;
    readonly onboardingComplete: boolean;
    readonly accountStatus: string;
  };
}

/**
 * Client component for account settings page
 * Handles payout setup state and UI interactions
 */
export function AccountSettingsClient({ user }: AccountSettingsClientProps) {
  const router = useRouter();
  const [showPayoutSetup, setShowPayoutSetup] = useState(false);

  // Determine badge variant based on account status
  const getStatusBadge = () => {
    switch (user.accountStatus) {
      case "active":
        return (
          <Badge variant="success" size="md">
            Active
          </Badge>
        );
      case "restricted":
        return (
          <Badge variant="warning" size="md">
            Action Required
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="info" size="md">
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="md">
            Not Set Up
          </Badge>
        );
    }
  };

  const handlePayoutSetupComplete = () => {
    setShowPayoutSetup(false);
    // Refresh the page to show updated status
    globalThis.location.reload();
  };

  const renderPayoutContent = () => {
    if (user.hasConnectAccount && user.onboardingComplete && user.accountStatus === "active") {
      return (
        <>
          <Text color="$textSecondary">
            Your payout account is active. When you make sales, funds will be transferred to your
            bank account automatically.
          </Text>
          <Row gap="$md">
            <Button butterVariant="primary" size="$4" onPress={() => router.push("/seller/sales")}>
              View Sales
            </Button>
            <Button
              size="$4"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$border"
              onPress={() => router.push("/seller/settings")}
            >
              Payout Settings
            </Button>
          </Row>
        </>
      );
    }

    if (user.hasConnectAccount && user.onboardingComplete && user.accountStatus === "restricted") {
      return (
        <>
          <Text color="$textSecondary">
            Your payout account needs attention. Please update your information to continue
            receiving payments.
          </Text>
          <Row gap="$md">
            <Button butterVariant="primary" size="$4" onPress={() => setShowPayoutSetup(true)}>
              Resolve Issues
            </Button>
          </Row>
        </>
      );
    }

    if (user.hasConnectAccount && user.onboardingComplete) {
      return (
        <>
          <Text color="$textSecondary">
            Your payout account is being verified. This usually takes 1-2 business days.
          </Text>
        </>
      );
    }

    if (user.hasConnectAccount) {
      return (
        <>
          <Text color="$textSecondary">
            Your payout setup is incomplete. Complete the setup to receive payments when you make
            sales.
          </Text>
          <Row gap="$md">
            <Button butterVariant="primary" size="$4" onPress={() => setShowPayoutSetup(true)}>
              Continue Setup
            </Button>
          </Row>
        </>
      );
    }

    return (
      <>
        <Text color="$textSecondary">
          Set up payouts to receive money when you sell items. This is a one-time setup that takes
          about 2-3 minutes.
        </Text>
        <Row>
          <Button butterVariant="primary" size="$5" onPress={() => setShowPayoutSetup(true)}>
            Set Up Payouts
          </Button>
        </Row>
      </>
    );
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
    <Container size="lg" paddingHorizontal="$md">
      <Column gap="$xl" fullWidth>
        <Column gap="$sm">
          <Heading level={1}>Account Settings</Heading>
          <Text color="$textSecondary">Manage your account and payment settings</Text>
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
            {user.phone && (
              <Column gap="$xs">
                <Text weight="medium">Phone</Text>
                <Text color="$textSecondary">{user.phone}</Text>
              </Column>
            )}
          </Column>
        </Card>

        {/* Payout Setup Card */}
        <Card variant="elevated" padding="$lg">
          <Column gap="$lg">
            <Row alignItems="center" justifyContent="space-between">
              <Heading level={3}>Payout Setup</Heading>
              {getStatusBadge()}
            </Row>
            {renderPayoutContent()}
          </Column>
        </Card>
      </Column>
    </Container>
  );
}
