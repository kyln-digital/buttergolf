"use client";

import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Card } from "@buttergolf/ui";

export default function SettingsPage() {
  const router = useRouter();

  const settingsItems = [
    {
      title: "Shipping Addresses",
      description: "Manage your default shipping addresses for selling items",
      href: "/settings/addresses",
      icon: "📦",
    },
    {
      title: "Payment Settings",
      description: "Manage your Stripe Connect account for receiving payments",
      href: "/settings/payments",
      icon: "💳",
    },
    {
      title: "Profile",
      description: "Update your profile information and preferences",
      href: "/settings/profile",
      icon: "👤",
    },
  ];

  return (
    <Column backgroundColor="$background" minHeight="100vh" alignItems="center" width="100%">
      <Column
        maxWidth={800}
        paddingHorizontal="$6"
        width="100%"
        alignSelf="center"
        marginHorizontal="auto"
      >
        <Column gap="$xl" paddingVertical="$10" width="100%">
          {/* Header */}
          <Column gap="$md" alignItems="center">
            <Heading level={2}>Account Settings</Heading>
            <Text color="$textSecondary" textAlign="center">
              Manage your account preferences and selling settings
            </Text>
          </Column>

          {/* Settings Items */}
          <Column gap="$md" width="100%">
            {settingsItems.map((item) => (
              <Card
                key={item.href}
                variant="elevated"
                padding="$lg"
                width="100%"
                onPress={() => router.push(item.href)}
                hoverStyle={{
                  backgroundColor: "$backgroundHover",
                  scale: 1.02,
                }}
                pressStyle={{
                  backgroundColor: "$backgroundPress",
                  scale: 0.98,
                }}
              >
                <Row gap="$md" alignItems="center" justifyContent="space-between">
                  <Row gap="$md" alignItems="center" flex={1}>
                    <Text size="$8">{item.icon}</Text>
                    <Column gap="$xs" flex={1}>
                      <Text size="$6" weight="semibold">
                        {item.title}
                      </Text>
                      <Text color="$textSecondary" size="$3">
                        {item.description}
                      </Text>
                    </Column>
                  </Row>
                  <Text color="$textMuted">→</Text>
                </Row>
              </Card>
            ))}
          </Column>
        </Column>
      </Column>
    </Column>
  );
}
