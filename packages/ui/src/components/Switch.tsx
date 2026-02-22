"use client";

import { Switch as TamaguiSwitch, styled, GetProps, Label, XStack } from "tamagui";

/**
 * Switch Component
 *
 * A toggle switch built on @tamagui/switch for boolean state toggling.
 * Uses compound component pattern (Switch, Switch.Thumb).
 *
 * @example
 * // Basic switch
 * <Switch size="$4">
 *   <Switch.Thumb animation="bouncy" />
 * </Switch>
 *
 * @example
 * // Controlled switch with label
 * <SwitchWithLabel
 *   label="Enable notifications"
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 */

// Styled Switch frame with brand colours and proper sizing
const SwitchFrame = styled(TamaguiSwitch, {
  name: "Switch",
  backgroundColor: "$cloudMist",
  borderRadius: 999,
  width: 52,
  height: 32,
  padding: 3,

  variants: {
    checked: {
      true: {
        backgroundColor: "$primary",
      },
    },
  } as const,
});

// Styled Switch thumb with brand colours and proper positioning
const SwitchThumb = styled(TamaguiSwitch.Thumb, {
  name: "SwitchThumb",
  backgroundColor: "$pureWhite",
  borderRadius: 999,
  width: 26,
  height: 26,
  // Ensure thumb shadows for depth
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 3,
});

// Main Switch component as compound component
export const Switch = SwitchFrame as typeof SwitchFrame & {
  Thumb: typeof SwitchThumb;
};

Switch.Thumb = SwitchThumb;

// Export types
export type SwitchProps = GetProps<typeof Switch>;
export type SwitchThumbProps = GetProps<typeof SwitchThumb>;

/**
 * SwitchWithLabel - Convenience wrapper for switch with label
 *
 * @example
 * <SwitchWithLabel
 *   label="Show favourites only"
 *   checked={showFavourites}
 *   onCheckedChange={setShowFavourites}
 * />
 */
export interface SwitchWithLabelProps {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "$2" | "$3" | "$4" | "$5";
  id?: string;
}

export function SwitchWithLabel({
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  size = "$4",
  id,
}: SwitchWithLabelProps) {
  const switchId = id ?? `switch-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <XStack alignItems="center" gap="$3">
      <Switch
        id={switchId}
        size={size}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      >
        <Switch.Thumb animation="bouncy" />
      </Switch>
      <Label
        htmlFor={switchId}
        size={size}
        cursor={disabled ? "not-allowed" : "pointer"}
        opacity={disabled ? 0.5 : 1}
      >
        {label}
      </Label>
    </XStack>
  );
}
