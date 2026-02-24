"use client";

import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Card } from "@buttergolf/ui";
import { CreditCard, Lightbulb } from "@tamagui/lucide-icons";

/**
 * Payment Methods Page
 *
 * Allows users to manage their saved payment methods for purchases.
 * Note: This is separate from seller payout settings which uses Stripe Connect.
 */
export default function PaymentMethodsPage() {
  const router = useRouter();

  return (
    <Column
      maxWidth={800}
      paddingHorizontal="$6"
      width="100%"
      alignSelf="center"
      marginHorizontal="auto"
    >
      <Column gap="$xl" paddingVertical="$6" width="100%">
        {/* Header */}
        <Column gap="$sm">
          <Button chromeless size="$3" onPress={() => router.push("/account")}>
            ← Back to Account
          </Button>
          <Heading level={2}>Payment Methods</Heading>
          <Text color="$textSecondary">Manage your saved payment methods for faster checkout</Text>
        </Column>

        {/* Coming Soon Card */}
        <Card variant="outlined" padding="$xl">
          <Column gap="$lg" alignItems="center">
            <Column backgroundColor="$backgroundHover" borderRadius="$full" padding="$4">
              <CreditCard size={48} color="$textMuted" />
            </Column>
            <Column gap="$sm" alignItems="center">
              <Heading level={3}>Coming Soon</Heading>
              <Text color="$textSecondary" textAlign="center" maxWidth={400}>
                We're working on letting you save payment methods for faster checkout. For now,
                you'll enter your payment details at checkout.
              </Text>
            </Column>
            <Button butterVariant="primary" size="$4" onPress={() => router.push("/account")}>
              Back to Account
            </Button>
          </Column>
        </Card>

        {/* Info Card */}
        <Card variant="filled" padding="$lg" backgroundColor="$secondaryLight">
          <Row gap="$md" alignItems="flex-start">
            <Lightbulb size={20} color="$secondary" />
            <Column gap="$xs" flex={1}>
              <Text weight="medium" color="$secondary">
                Looking for payout settings?
              </Text>
              <Text size="$4" color="$textSecondary">
                To manage how you receive payments from sales, go to your{" "}
                <Text
                  size="$4"
                  color="$primary"
                  fontWeight="500"
                  onPress={() => router.push("/seller/settings")}
                  style={{ cursor: "pointer", textDecorationLine: "underline" }}
                >
                  Seller Settings
                </Text>
                .
              </Text>
            </Column>
          </Row>
        </Card>
      </Column>
    </Column>
  );
}
