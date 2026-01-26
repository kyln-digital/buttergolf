"use client";

import React from "react";
import { Row, Column, Text, Badge } from "@buttergolf/ui";
import { Button } from "tamagui";
import { ChevronRight } from "@tamagui/lucide-icons";

export interface AccountMenuItemProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Menu item label */
  label: string;
  /** Optional description text */
  description?: string;
  /** Badge count or text (e.g., "3" for notifications) */
  badge?: string | number;
  /** Badge variant for different styles */
  badgeVariant?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
  /** Whether to show chevron arrow */
  showChevron?: boolean;
  /** Disable the item */
  disabled?: boolean;
  /** Press handler */
  onPress?: () => void;
}

/**
 * Reusable menu item component for account settings pages.
 * Displays an icon, label, optional description, optional badge, and chevron.
 */
export function AccountMenuItem({
  icon,
  label,
  description,
  badge,
  badgeVariant = "primary",
  showChevron = true,
  disabled = false,
  onPress,
}: Readonly<AccountMenuItemProps>) {
  return (
    <Button
      unstyled
      backgroundColor="$surface"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      padding="$4"
      pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
      hoverStyle={{ backgroundColor: "$backgroundHover" }}
      onPress={onPress}
      disabled={disabled}
      opacity={disabled ? 0.5 : 1}
    >
      <Row alignItems="center" gap="$3" flex={1}>
        {/* Icon */}
        {icon}

        {/* Label and Description */}
        <Column flex={1} gap="$1">
          <Text size="$5" fontWeight="500" color="$text">
            {label}
          </Text>
          {description && (
            <Text size="$3" color="$textSecondary" numberOfLines={1}>
              {description}
            </Text>
          )}
        </Column>

        {/* Badge */}
        {badge !== undefined && (
          <Badge
            size="sm"
            variant={
              badgeVariant === "primary"
                ? "primary"
                : badgeVariant === "success"
                  ? "success"
                  : badgeVariant === "warning"
                    ? "warning"
                    : badgeVariant === "error"
                      ? "error"
                      : badgeVariant === "info"
                        ? "info"
                        : "neutral"
            }
          >
            {badge}
          </Badge>
        )}

        {/* Chevron */}
        {showChevron && <ChevronRight size={20} color="$textMuted" />}
      </Row>
    </Button>
  );
}
