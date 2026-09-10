"use client";

import React from "react";
import { Platform } from "react-native";
import type { GestureResponderEvent } from "react-native";
import { Row, Column, Text, Badge } from "@buttergolf/ui";
import { ChevronRight } from "@tamagui/lucide-icons";

type BadgeVariant = "primary" | "success" | "warning" | "error" | "info" | "neutral";

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
  badgeVariant?: BadgeVariant;
  /** Whether to show chevron arrow */
  showChevron?: boolean;
  /** Disable the item */
  disabled?: boolean;
  /**
   * Web only: render the row as a real anchor so it works with middle-click,
   * copy-link and keyboard navigation. Pair with a press handler that calls
   * preventDefault for plain clicks (see `useLinkPress` on web).
   */
  href?: string;
  /** Press handler */
  onPress?: (event?: GestureResponderEvent) => void;
}

/** Filled badge variants carry white text; tinted ones carry dark text. */
const BADGE_TEXT_COLOR: Record<BadgeVariant, "$textInverse" | "$text"> = {
  primary: "$textInverse",
  success: "$text",
  warning: "$text",
  error: "$text",
  info: "$text",
  neutral: "$text",
};

const focusRing = {
  outlineColor: "$primary",
  outlineStyle: "solid",
  outlineWidth: 2,
  outlineOffset: 2,
} as const;

/**
 * Reusable menu row for account pages: icon, label, optional description,
 * optional badge and a chevron. Renders as an anchor on web when `href` is
 * given (a plain pressable row otherwise), never as a native <button>, so the
 * text keeps its own alignment and the card border is honoured.
 */
export function AccountMenuItem({
  icon,
  label,
  description,
  badge,
  badgeVariant = "primary",
  showChevron = true,
  disabled = false,
  href,
  onPress,
}: Readonly<AccountMenuItemProps>) {
  const isWeb = Platform.OS === "web";
  const linkProps =
    isWeb && href
      ? { tag: "a" as const, href, style: { textDecoration: "none" } }
      : { role: "button" as const };

  return (
    <Row
      alignItems="center"
      gap="$md"
      backgroundColor="$surface"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      paddingVertical="$md"
      paddingHorizontal="$md"
      minHeight={64}
      cursor={disabled ? "default" : "pointer"}
      opacity={disabled ? 0.5 : 1}
      focusable={!disabled}
      hoverStyle={disabled ? undefined : { borderColor: "$borderHover" }}
      pressStyle={disabled ? undefined : { backgroundColor: "$backgroundPress" }}
      focusVisibleStyle={focusRing}
      aria-disabled={disabled || undefined}
      onPress={disabled ? undefined : onPress}
      {...linkProps}
    >
      {icon}

      <Column flex={1} gap={2} minWidth={0}>
        <Text size="$5" fontWeight="600" color="$text">
          {label}
        </Text>
        {description && (
          <Text size="$3" color="$textSecondary" numberOfLines={1}>
            {description}
          </Text>
        )}
      </Column>

      {badge !== undefined && (
        <Badge size="sm" variant={badgeVariant}>
          <Text size="$2" fontWeight="600" color={BADGE_TEXT_COLOR[badgeVariant]}>
            {badge}
          </Text>
        </Badge>
      )}

      {showChevron && <ChevronRight size={20} color="$textSecondary" />}
    </Row>
  );
}
