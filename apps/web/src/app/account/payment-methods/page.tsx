"use client";

import { Column, Row, Heading, Text, Button, Card } from "@buttergolf/ui";
import { ArrowLeft, CreditCard, Lightbulb } from "@tamagui/lucide-icons";
import { useLinkPress } from "@/hooks/useLinkPress";

/**
 * Payment Methods Page
 *
 * Allows users to manage their saved payment methods for purchases.
 * Note: This is separate from seller payout settings which uses Stripe Connect.
 */
export default function PaymentMethodsPage() {
  const linkPress = useLinkPress();

  return (
    <Column
      maxWidth={800}
      paddingHorizontal="$md"
      paddingTop="$lg"
      paddingBottom="$3xl"
      width="100%"
      alignSelf="center"
      marginHorizontal="auto"
      gap="$xl"
    >
      {/* Header */}
      <Column gap="$sm" alignItems="flex-start">
        <Button
          butterVariant="ghost"
          size="$3"
          icon={ArrowLeft}
          tag="a"
          href="/account"
          onPress={linkPress("/account")}
        >
          Back to account
        </Button>
        <Column gap="$xs">
          <Heading level={1} size="$8">
            Payment methods
          </Heading>
          <Text size="$4" color="$textSecondary">
            Manage your saved payment methods for faster checkout
          </Text>
        </Column>
      </Column>

      {/* Coming soon */}
      <Card variant="outlined" padding="$xl" borderRadius="$lg">
        <Column gap="$lg" alignItems="center">
          <Column backgroundColor="$backgroundHover" borderRadius="$full" padding="$md">
            <CreditCard size={40} color="$textSecondary" />
          </Column>
          <Column gap="$xs" alignItems="center">
            <Heading level={2} size="$6">
              Coming soon
            </Heading>
            <Text size="$4" color="$textSecondary" textAlign="center" maxWidth={400}>
              We&apos;re working on letting you save payment methods for faster checkout. For now,
              you&apos;ll enter your payment details at checkout.
            </Text>
          </Column>
          <Button
            butterVariant="secondary"
            size="$4"
            tag="a"
            href="/account"
            onPress={linkPress("/account")}
          >
            Back to account
          </Button>
        </Column>
      </Card>

      {/* Payout pointer */}
      <Card variant="filled" padding="$md" backgroundColor="$secondaryLight" borderRadius="$lg">
        <Row gap="$md" alignItems="flex-start">
          <Lightbulb size={20} color="$secondary" />
          <Column gap={2} flex={1}>
            <Text size="$5" fontWeight="600" color="$secondary">
              Looking for payout settings?
            </Text>
            <Text size="$4" color="$textSecondary">
              To manage how you receive payments from sales, go to your{" "}
              <Text
                size="$4"
                color="$primary"
                fontWeight="600"
                tag="a"
                {...{ href: "/seller/settings" }}
                onPress={linkPress("/seller/settings")}
                textDecorationLine="underline"
              >
                seller settings
              </Text>
              .
            </Text>
          </Column>
        </Row>
      </Card>
    </Column>
  );
}
