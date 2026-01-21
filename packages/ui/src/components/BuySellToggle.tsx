/**
 * BuySellToggle Component
 *
 * Cross-platform toggle for switching between Buying and Selling modes.
 * Built with Tamagui Tabs for native animations and accessibility.
 *
 * Active (Spiced Clementine):
 * - Background: #F45314
 * - Border: 1px #F04300
 * - Drop shadow: 0 1 5 0 rgba(0,0,0,0.25)
 * - Inner shadow: inset 0 2 2 0 #FF7E4C (web only)
 *
 * Inactive (White/Cream):
 * - Background: linear-gradient(#FFFFFF, #FFFEF9) on web, #FFFEF9 on native
 * - Border: 1px #FAFAFA
 * - Drop shadow: 0 1 5 0 rgba(0,0,0,0.10)
 *
 * @example
 * ```tsx
 * // Mobile - flexible width
 * <BuySellToggle
 *   activeMode="buying"
 *   onModeChange={(mode) => setMode(mode)}
 * />
 *
 * // Web - fixed width buttons
 * <BuySellToggle
 *   activeMode="buying"
 *   onModeChange={(mode) => setMode(mode)}
 *   variant="desktop"
 * />
 * ```
 */

"use client";

import { useMemo, useState } from "react";
import { Tabs, SizableText, styled, AnimatePresence, View } from "tamagui";

export type BuySellMode = "buying" | "selling";

export interface BuySellToggleProps {
  /** Currently active mode */
  activeMode: BuySellMode;
  /** Callback when mode changes */
  onModeChange: (mode: BuySellMode) => void;
  /** Layout variant - "mobile" uses flex, "desktop" uses fixed widths */
  variant?: "mobile" | "desktop";
}

/**
 * Styled Tabs.Tab (trigger) with pill styling matching AuthButton
 */
const StyledTab = styled(Tabs.Tab, {
  name: "BuySellTab",
  borderRadius: "$full",
  paddingHorizontal: "$6",
  paddingVertical: "$3",
  cursor: "pointer",
  borderWidth: 1,
  // Disable Tamagui's default tab unstyled prop
  unstyled: true,

  // Default inactive state - use semantic tokens for dark mode support
  backgroundColor: "$surface",
  borderColor: "$border",

  // Web shadows for inactive
  // @ts-ignore - boxShadow only exists on web
  boxShadow: "0px 1px 5px 0px rgba(0, 0, 0, 0.1)",

  hoverStyle: {
    opacity: 0.9,
    backgroundColor: "$backgroundHover",
  },

  pressStyle: {
    scale: 0.98,
    opacity: 0.9,
  },

  // Override Tamagui's built-in active/selected states
  focusStyle: {
    outlineWidth: 2,
    outlineColor: "$primary",
    outlineStyle: "solid",
  },

  variants: {
    active: {
      true: {
        // Spiced Clementine - explicit hex to override any defaults
        backgroundColor: "#F45314",
        borderColor: "#F04300",
        // @ts-ignore - boxShadow only exists on web
        boxShadow:
          "0px 1px 5px 0px rgba(0, 0, 0, 0.25), inset 0px 2px 2px 0px #FF7E4C",
        hoverStyle: {
          backgroundColor: "#E04A10",
          opacity: 1,
        },
        pressStyle: {
          backgroundColor: "#D04410",
          scale: 0.98,
        },
      },
      false: {
        backgroundColor: "$surface",
        borderColor: "$border",
        // @ts-ignore - boxShadow only exists on web
        boxShadow: "0px 1px 5px 0px rgba(0, 0, 0, 0.1)",
        hoverStyle: {
          backgroundColor: "$backgroundHover",
          opacity: 0.95,
        },
      },
    },
    layout: {
      mobile: {
        flex: 1,
      },
      desktop: {
        width: "25%",
        minWidth: 280,
      },
    },
  } as const,
});

/**
 * Styled Tabs.List as a row with proper spacing
 */
const StyledTabsList = styled(Tabs.List, {
  name: "BuySellTabsList",
  width: "100%",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "transparent",
  borderBottomWidth: 0,

  variants: {
    layout: {
      mobile: {
        gap: "$4",
      },
      desktop: {
        gap: "$lg",
      },
    },
  } as const,
});

/**
 * Active tab indicator that slides between tabs
 */
const TabIndicator = styled(View, {
  name: "BuySellTabIndicator",
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: 3,
  backgroundColor: "$primary",
  borderRadius: "$full",
  animation: "medium",
});

export function BuySellToggle({
  activeMode,
  onModeChange,
  variant = "mobile",
}: Readonly<BuySellToggleProps>) {
  const [direction, setDirection] = useState<"left" | "right">("right");

  const handleValueChange = (value: string) => {
    const newMode = value as BuySellMode;
    // Track direction for potential slide animations
    setDirection(newMode === "selling" ? "right" : "left");
    onModeChange(newMode);
  };

  const layout = variant === "desktop" ? "desktop" : "mobile";

  return (
    <Tabs
      value={activeMode}
      onValueChange={handleValueChange}
      orientation="horizontal"
      width="100%"
      flexDirection="column"
      activationMode="manual"
    >
      <StyledTabsList layout={layout}>
        <StyledTab
          value="buying"
          active={activeMode === "buying"}
          layout={layout}
          aria-label="Switch to buying mode"
        >
          <SizableText
            size="$5"
            fontWeight={activeMode === "buying" ? "600" : "500"}
            color={activeMode === "buying" ? "$textInverse" : "$text"}
          >
            Buying
          </SizableText>
        </StyledTab>

        <StyledTab
          value="selling"
          active={activeMode === "selling"}
          layout={layout}
          aria-label="Switch to selling mode"
        >
          <SizableText
            size="$5"
            fontWeight={activeMode === "selling" ? "600" : "500"}
            color={activeMode === "selling" ? "$textInverse" : "$text"}
          >
            Selling
          </SizableText>
        </StyledTab>
      </StyledTabsList>

      {/* No Tabs.Content needed - the parent handles content switching */}
    </Tabs>
  );
}
