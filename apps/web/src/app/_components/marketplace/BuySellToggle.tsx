"use client";

import {
  Row,
  BuySellToggle as SharedBuySellToggle,
  type BuySellMode,
  useMedia,
} from "@buttergolf/ui";

interface BuySellToggleProps {
  activeMode: BuySellMode;
  onModeChange: (mode: BuySellMode) => void;
}

/**
 * BuySellToggle Component (Web Wrapper)
 *
 * Wraps the shared BuySellToggle with web-specific container styling.
 * Uses the desktop variant for wider button widths.
 * Hidden on mobile — selling is accessible via the bottom nav "Sell" tab.
 */
export function BuySellToggle({ activeMode, onModeChange }: Readonly<BuySellToggleProps>) {
  const media = useMedia();

  if (!media.gtSm) return null;

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
