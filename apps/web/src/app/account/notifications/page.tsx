"use client";

import { useState } from "react";
import { Column, Row, Heading, Text, Button, Card, Switch } from "@buttergolf/ui";
import {
  ArrowLeft,
  Bell,
  Mail,
  ShoppingBag,
  Store,
  MessageCircle,
  Smartphone,
} from "@tamagui/lucide-icons";
import { useLinkPress } from "@/hooks/useLinkPress";

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
  const linkPress = useLinkPress();

  // Notification preferences (would be loaded from API in production)
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: "order_updates",
      label: "Order updates",
      description: "Get notified when your orders are shipped, delivered, or need attention",
      icon: <ShoppingBag size={22} color="$text" />,
      enabled: true,
    },
    {
      id: "seller_updates",
      label: "Seller updates",
      description: "Notifications about your sales, payouts, and listing activity",
      icon: <Store size={22} color="$text" />,
      enabled: true,
    },
    {
      id: "messages",
      label: "Messages",
      description: "Get notified when you receive a new message from a buyer or seller",
      icon: <MessageCircle size={22} color="$text" />,
      enabled: true,
    },
    {
      id: "marketing",
      label: "Marketing & promotions",
      description: "Tips, deals, and updates about ButterGolf",
      icon: <Mail size={22} color="$text" />,
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
            Notifications
          </Heading>
          <Text size="$4" color="$textSecondary">
            Choose what notifications you&apos;d like to receive
          </Text>
        </Column>
      </Column>

      {/* Email notifications */}
      <Column gap="$md">
        <Row alignItems="center" gap="$sm">
          <Bell size={20} color="$text" />
          <Heading level={2} size="$5">
            Email notifications
          </Heading>
        </Row>

        <Column gap="$sm">
          {settings.map((setting) => (
            <Card key={setting.id} variant="outlined" padding="$md" borderRadius="$lg">
              <Row alignItems="center" justifyContent="space-between" gap="$md">
                <Row gap="$md" alignItems="center" flex={1} minWidth={0}>
                  {setting.icon}
                  <Column gap={2} flex={1} minWidth={0}>
                    <Text size="$5" fontWeight="600" color="$text">
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
                  aria-label={setting.label}
                >
                  <Switch.Thumb animation="quick" />
                </Switch>
              </Row>
            </Card>
          ))}
        </Column>
      </Column>

      {/* Push notifications note */}
      <Card variant="filled" padding="$md" backgroundColor="$backgroundHover" borderRadius="$lg">
        <Row gap="$sm" alignItems="center">
          <Smartphone size={18} color="$textSecondary" />
          <Text size="$3" color="$textSecondary" flex={1}>
            Push notifications are managed through your device settings when using the ButterGolf
            mobile app.
          </Text>
        </Row>
      </Card>
    </Column>
  );
}
