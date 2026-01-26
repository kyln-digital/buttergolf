"use client";

import React, { useState, useCallback } from "react";
import { Column, Row, Text, Button, Heading, ScrollView } from "@buttergolf/ui";
import { Button as TamaguiButton, View, Switch } from "tamagui";
import { ArrowLeft, Bell, ShoppingBag, MessageCircle, Tag, Mail } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "react-native";

interface NotificationSettings {
  orderUpdates: boolean;
  messageNotifications: boolean;
  promotionalEmails: boolean;
  priceDropAlerts: boolean;
  newListings: boolean;
}

export interface NotificationSettingsScreenProps {
  /** Current notification settings */
  settings?: NotificationSettings;
  /** Update notification settings */
  onUpdateSettings: (settings: NotificationSettings) => Promise<void>;
  /** Navigate back */
  onBack: () => void;
}

const defaultSettings: NotificationSettings = {
  orderUpdates: true,
  messageNotifications: true,
  promotionalEmails: false,
  priceDropAlerts: true,
  newListings: false,
};

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

function SettingItem({ icon, title, description, value, onToggle }: SettingItemProps) {
  return (
    <Row
      backgroundColor="$surface"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      padding="$4"
      alignItems="center"
      gap="$3"
    >
      {icon}
      <Column flex={1}>
        <Text size="$4" fontWeight="500">
          {title}
        </Text>
        <Text size="$3" color="$textSecondary">
          {description}
        </Text>
      </Column>
      <Switch checked={value} onCheckedChange={onToggle} />
    </Row>
  );
}

export function NotificationSettingsScreen({
  settings: initialSettings,
  onUpdateSettings,
  onBack,
}: Readonly<NotificationSettingsScreenProps>) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<NotificationSettings>(
    initialSettings || defaultSettings
  );
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(
    (key: keyof NotificationSettings) => (value: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdateSettings(settings);
      Alert.alert("Success", "Notification preferences saved.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [settings, onUpdateSettings]);

  return (
    <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* Header */}
      <Row
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Heading level={4} flex={1}>
          Notifications
        </Heading>
      </Row>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Push Notifications */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            PUSH NOTIFICATIONS
          </Text>

          <SettingItem
            icon={<ShoppingBag size={22} color="$primary" />}
            title="Order Updates"
            description="Get notified about your order status"
            value={settings.orderUpdates}
            onToggle={handleToggle("orderUpdates")}
          />

          <SettingItem
            icon={<MessageCircle size={22} color="$info" />}
            title="Messages"
            description="Receive alerts for new messages"
            value={settings.messageNotifications}
            onToggle={handleToggle("messageNotifications")}
          />

          <SettingItem
            icon={<Tag size={22} color="$warning" />}
            title="Price Drop Alerts"
            description="Get notified when favourited items drop in price"
            value={settings.priceDropAlerts}
            onToggle={handleToggle("priceDropAlerts")}
          />
        </Column>

        {/* Email Notifications */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            EMAIL NOTIFICATIONS
          </Text>

          <SettingItem
            icon={<Mail size={22} color="$textSecondary" />}
            title="Promotional Emails"
            description="Deals, discounts, and special offers"
            value={settings.promotionalEmails}
            onToggle={handleToggle("promotionalEmails")}
          />

          <SettingItem
            icon={<Bell size={22} color="$textSecondary" />}
            title="New Listings"
            description="Get notified about new items in your interests"
            value={settings.newListings}
            onToggle={handleToggle("newListings")}
          />
        </Column>

        {/* Info */}
        <Column backgroundColor="$gray100" borderRadius="$lg" padding="$4" marginBottom="$4">
          <Text size="$3" color="$textSecondary">
            You can change your notification preferences at any time. Push notifications require
            permission from your device settings.
          </Text>
        </Column>

        <Button
          butterVariant="primary"
          size="$5"
          width="100%"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </ScrollView>
    </Column>
  );
}
