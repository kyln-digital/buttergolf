"use client";

import type { PayoutStatus } from "@buttergolf/constants";
import { Button, Row, Text, View } from "@buttergolf/ui";
import { useLinkPress } from "@/hooks/useLinkPress";

const PAYOUTS_HREF = "/seller/payouts";
const SUPPORT_HREF = "/help-centre";

type BannerTone = "warning" | "error";

interface BannerContent {
  tone: BannerTone;
  message: string;
  action: { label: string; href: string } | null;
}

function formatDeadline(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Turn the payout status into one line of copy and, usually, one button.
 *
 * Order matters: the states Stripe has already acted on (rejected, restricted)
 * outrank the things the seller has simply not done yet.
 */
function describe(status: PayoutStatus): BannerContent | null {
  if (status.status === "rejected") {
    return {
      tone: "error",
      message: "We can't pay out to this account. Please contact support.",
      action: { label: "Contact support", href: SUPPORT_HREF },
    };
  }

  if (status.status === "restricted") {
    const deadline = status.requirements.currentDeadline
      ? formatDeadline(status.requirements.currentDeadline)
      : null;
    return {
      tone: "error",
      message: deadline
        ? `Payouts are paused until you update your details — please do this by ${deadline}`
        : "Payouts are paused until you update your details",
      action: { label: "Fix now", href: PAYOUTS_HREF },
    };
  }

  if (!status.hasAccount || status.needsDetails) {
    return {
      tone: "warning",
      message: "Set up payouts to get paid for your sales",
      action: { label: "Set up payouts", href: PAYOUTS_HREF },
    };
  }

  if (status.needsBankAccount) {
    return {
      tone: "warning",
      message: "Add a bank account so we can pay you",
      action: { label: "Add bank account", href: PAYOUTS_HREF },
    };
  }

  if (status.needsVerification) {
    return {
      tone: "warning",
      message: "We need to verify your identity before we can pay you",
      action: { label: "Verify now", href: PAYOUTS_HREF },
    };
  }

  if (status.requirements.pendingVerification.length > 0) {
    return {
      tone: "warning",
      message: "We're checking your details — payouts start automatically once that's done",
      action: null,
    };
  }

  return null;
}

interface PayoutRequirementsBannerProps {
  status: PayoutStatus | null;
}

/**
 * Slim banner across the top of the seller dashboard telling the seller what,
 * if anything, stands between them and being paid. Renders nothing once
 * payouts are live, and nothing at all until the status has loaded.
 */
export function PayoutRequirementsBanner({ status }: PayoutRequirementsBannerProps) {
  const linkPress = useLinkPress();

  if (!status || status.isComplete) return null;

  const content = describe(status);
  if (!content) return null;

  const isError = content.tone === "error";

  return (
    <View
      width="100%"
      backgroundColor={isError ? "$errorLight" : "$warningLight"}
      borderLeftWidth={4}
      borderLeftColor={isError ? "$error" : "$warning"}
      borderRadius="$md"
      paddingHorizontal="$md"
      paddingVertical="$sm"
    >
      <Row alignItems="center" justifyContent="space-between" gap="$md" flexWrap="wrap">
        <Text size="$5" color={isError ? "$error" : "$warning"} fontWeight="600" flexShrink={1}>
          {content.message}
        </Text>
        {content.action ? (
          <Button
            butterVariant={isError ? "primary" : "secondary"}
            size="$3"
            tag="a"
            href={content.action.href}
            onPress={linkPress(content.action.href)}
          >
            {content.action.label}
          </Button>
        ) : null}
      </Row>
    </View>
  );
}
