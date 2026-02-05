"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Column, Row, Heading, Text, Button, Card, Switch } from "@buttergolf/ui";
import { Bell, Mail, ShoppingBag, Store, MessageCircle } from "@tamagui/lucide-icons";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

/**
 * Notification Settings Page
 *
 * Allows users to manage their email and push notification preferences.
 */
export default function NotificationsPage() {
  const router = useRouter();

  // Notification preferences (would be loaded from API in production)
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: "order_updates",
      label: "Order Updates",
      description: "Get notified when your orders are shipped, delivered, or need attention",
      icon: <ShoppingBag size={22} color="$primary" />,
      enabled: true,
    },
    {
      id: "seller_updates",
      label: "Seller Updates",
      description: "Notifications about your sales, payouts, and listing activity",
      icon: <Store size={22} color="$success" />,
      enabled: true,
    },
    {
      id: "messages",
      label: "Messages",
      description: "Get notified when you receive a new message from a buyer or seller",
      icon: <MessageCircle size={22} color="$info" />,
      enabled: true,
    },
    {
      id: "marketing",
      label: "Marketing & Promotions",
      description: "Tips, deals, and updates about ButterGolf",
      icon: <Mail size={22} color="$warning" />,
      enabled: false,
    },
  ]);

  const handleToggle = async (id: string) => {
    // Update local state optimistically
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );

    // TODO: Save to API
    // try {
    //   await fetch('/api/notifications/preferences', {
    //     method: 'PUT',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ [id]: !settings.find(s => s.id === id)?.enabled }),
    //   });
    // } catch (error) {
    //   // Revert on error
    //   setSettings(prev => prev.map(setting =>
    //     setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
    //   ));
    // }
  };

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
          <Heading level={2}>Notifications</Heading>
          <Text color="$textSecondary">Choose what notifications you'd like to receive</Text>
        </Column>

        {/* Email Notifications Section */}
        <Column gap="$md">
          <Row alignItems="center" gap="$sm">
            <Bell size={20} color="$text" />
            <Text size="$5" fontWeight="600" color="$text">
              Email Notifications
            </Text>
          </Row>

          <Column gap="$sm">
            {settings.map((setting) => (
              <Card key={setting.id} variant="elevated" padding="$lg">
                <Row alignItems="center" justifyContent="space-between" gap="$md">
                  <Row gap="$md" alignItems="center" flex={1}>
                    {setting.icon}
                    <Column gap="$xs" flex={1}>
                      <Text size="$5" fontWeight="500" color="$text">
                        {setting.label}
                      </Text>
                      <Text size="$3" color="$textSecondary">
                        {setting.description}
                      </Text>
                    </Column>
                  </Row>
                  <Switch
                    size="$4"
                    checked={setting.enabled}
                    onCheckedChange={() => handleToggle(setting.id)}
                    backgroundColor={setting.enabled ? "$primary" : "$backgroundHover"}
                  >
                    <Switch.Thumb animation="quick" backgroundColor="$surface" />
                  </Switch>
                </Row>
              </Card>
            ))}
          </Column>
        </Column>

        {/* Info Card */}
        <Card variant="filled" padding="$md" backgroundColor="$backgroundHover">
          <Row gap="$sm" alignItems="center">
            <Text size="$5">📱</Text>
            <Text size="$3" color="$textSecondary" flex={1}>
              Push notifications are managed through your device settings when using the ButterGolf
              mobile app.
            </Text>
          </Row>
        </Card>
      </Column>
    </Column>
  );
}
