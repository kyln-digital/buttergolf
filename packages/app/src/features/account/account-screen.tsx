"use client";

import React from "react";
import { Column, Row, ScrollView, Text, Button, Heading, ThemeSwitcher } from "@buttergolf/ui";
import { Button as TamaguiButton, Avatar, Image } from "tamagui";
import { ArrowLeft, LogOut, Palette } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UserData {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  imageUrl?: string | null;
}

export interface AccountScreenProps {
  user: UserData | null;
  isLoading?: boolean;
  onSignOut?: () => void;
  onNavigateBack?: () => void;
}

/**
 * Account screen displaying user profile info and sign-out option.
 * Shows user avatar (with initials fallback), name, email, and sign-out button.
 */
export function AccountScreen({
  user,
  isLoading = false,
  onSignOut,
  onNavigateBack,
}: Readonly<AccountScreenProps>) {
  const insets = useSafeAreaInsets();

  // Generate initials for avatar fallback
  const getInitials = (): string => {
    if (!user) return "?";
    const first = user.firstName?.charAt(0)?.toUpperCase() || "";
    const last = user.lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || user.email?.charAt(0)?.toUpperCase() || "?";
  };

  // Generate display name
  const getDisplayName = (): string => {
    if (!user) return "User";
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(" ");
    }
    return "User";
  };

  return (
    <Column flex={1} backgroundColor="$background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
        }}
      >
        {/* Header with back button */}
        {onNavigateBack && (
          <Row alignItems="center" marginBottom="$6">
            <TamaguiButton
              chromeless
              circular
              size="$4"
              onPress={onNavigateBack}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color="$text" />
            </TamaguiButton>
          </Row>
        )}

        {/* Profile Section */}
        <Column alignItems="center" gap="$4" paddingTop="$4">
          {/* Avatar */}
          <Avatar circular size="$12">
            {user?.imageUrl ? (
              <Avatar.Image
                accessibilityLabel={getDisplayName()}
                src={user.imageUrl}
              />
            ) : (
              <Avatar.Fallback
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
              >
                <Text size="$9" color="$textInverse" fontWeight="600">
                  {getInitials()}
                </Text>
              </Avatar.Fallback>
            )}
          </Avatar>

          {/* User Name */}
          <Heading level={2} size="$8" color="$text" textAlign="center">
            {getDisplayName()}
          </Heading>

          {/* User Email */}
          {user?.email && (
            <Text size="$5" color="$textSecondary" textAlign="center">
              {user.email}
            </Text>
          )}
        </Column>

        {/* Settings Section */}
        <Column paddingTop="$8" gap="$4">
          {/* Theme Switcher */}
          <Column
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            gap="$3"
          >
            <Row alignItems="center" gap="$2">
              <Palette size={20} color="$text" />
              <Text size="$5" fontWeight="600" color="$text">
                Appearance
              </Text>
            </Row>
            <ThemeSwitcher showLabels />
          </Column>
        </Column>

        {/* Sign Out Button */}
        <Column paddingTop="$6" gap="$4">
          <Button
            size="$5"
            backgroundColor="$surface"
            borderWidth={1}
            borderColor="$border"
            onPress={onSignOut}
            disabled={isLoading}
            icon={<LogOut size={20} color="$text" />}
          >
            <Text color="$text" fontWeight="500">
              Sign Out
            </Text>
          </Button>
        </Column>
      </ScrollView>
    </Column>
  );
}
