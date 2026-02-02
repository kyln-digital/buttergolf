"use client";

import { Row, BuySellToggle as SharedBuySellToggle, type BuySellMode } from "@buttergolf/ui";

interface BuySellToggleProps {
  activeMode: BuySellMode;
  onModeChange: (mode: BuySellMode) => void;
}

/**
 * BuySellToggle Component (Web Wrapper)
 *
 * Wraps the shared BuySellToggle with web-specific container styling.
 * Uses the desktop variant for wider button widths.
 */
export function BuySellToggle({ activeMode, onModeChange }: Readonly<BuySellToggleProps>) {
  return (
    <Row
      width="100%"
      justifyContent="center"
      paddingVertical="$lg"
      paddingHorizontal="$md"
      backgroundColor="$background"
    >
      <SharedBuySellToggle activeMode={activeMode} onModeChange={onModeChange} variant="desktop" />
    </Row>
  );
}
