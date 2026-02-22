/**
 * SegmentedTabs Component
 *
 * A sleek, modern tabbed navigation component built on Tamagui's native Tabs primitive.
 * Features an animated underline indicator, proper accessibility (WAI-ARIA tabs pattern),
 * keyboard navigation, and cross-platform support.
 *
 * @example
 * ```tsx
 * const [tab, setTab] = useState("all");
 *
 * <SegmentedTabs value={tab} onValueChange={setTab}>
 *   <SegmentedTabs.List>
 *     <SegmentedTabs.Tab value="all">All Orders</SegmentedTabs.Tab>
 *     <SegmentedTabs.Tab value="purchases" icon={<ShoppingBag size={16} />}>
 *       Purchases
 *     </SegmentedTabs.Tab>
 *   </SegmentedTabs.List>
 * </SegmentedTabs>
 * ```
 */

"use client";

import { useState, useCallback, type ReactNode } from "react";
import { Tabs, styled, SizableText, View, type TabsProps, type GetProps } from "tamagui";

// ─── Tab Trigger ─────────────────────────────────────────────────────────────

const StyledTabTrigger = styled(Tabs.Tab, {
  name: "SegmentedTabTrigger",
  unstyled: true,
  backgroundColor: "transparent",
  borderWidth: 0,
  borderRadius: 0,
  paddingHorizontal: "$md",
  paddingVertical: "$sm",
  cursor: "pointer",
  flexDirection: "row",
  alignItems: "center",
  gap: "$xs",
  position: "relative",

  hoverStyle: {
    backgroundColor: "$overlayDark5",
  },

  pressStyle: {
    backgroundColor: "$overlayDark10",
  },

  focusStyle: {
    backgroundColor: "$overlayDark5",
    outlineWidth: 2,
    outlineColor: "$primary",
    outlineStyle: "solid",
    outlineOffset: -2,
  },
});

interface SegmentedTabTriggerProps extends GetProps<typeof StyledTabTrigger> {
  /** Icon element rendered before label */
  icon?: ReactNode;
  /** Badge count displayed after label */
  count?: number;
  children: ReactNode;
}

function SegmentedTabTrigger({
  icon,
  count,
  children,
  ...props
}: Readonly<SegmentedTabTriggerProps>) {
  return (
    <StyledTabTrigger {...props}>
      {icon}
      {typeof children === "string" ? (
        <SizableText size="$4" fontWeight="500" color="inherit">
          {children}
        </SizableText>
      ) : (
        children
      )}
      {count !== undefined && (
        <SizableText size="$3" color="inherit" opacity={0.7}>
          ({count})
        </SizableText>
      )}
    </StyledTabTrigger>
  );
}

// ─── Tab List ────────────────────────────────────────────────────────────────

const StyledTabList = styled(Tabs.List, {
  name: "SegmentedTabList",
  backgroundColor: "transparent",
  borderBottomWidth: 0,
  gap: 0,
  position: "relative",
});

const UnderlineTrack = styled(View, {
  name: "SegmentedTabUnderlineTrack",
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: 2,
  backgroundColor: "$border",
});

const UnderlineIndicator = styled(View, {
  name: "SegmentedTabUnderlineIndicator",
  position: "absolute",
  bottom: 0,
  height: 3,
  backgroundColor: "$primary",
  borderTopLeftRadius: 3,
  borderTopRightRadius: 3,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — animation in styled() base works at runtime; TS types for styled config don't include it
  animation: "fast",
});

// ─── Main Tabs Container ────────────────────────────────────────────────────

interface SegmentedTabsProps extends Omit<TabsProps, "orientation"> {
  children: ReactNode;
}

function SegmentedTabsRoot({ children, ...props }: Readonly<SegmentedTabsProps>) {
  return (
    <Tabs orientation="horizontal" flexDirection="column" activationMode="manual" {...props}>
      {children}
    </Tabs>
  );
}

// ─── Animated List Wrapper ──────────────────────────────────────────────────

interface SegmentedTabListProps {
  children: ReactNode;
  /** The currently active tab value — used to position the underline */
  activeValue?: string;
}

function SegmentedTabList({ children, activeValue }: Readonly<SegmentedTabListProps>) {
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});

  const handleTabLayout = useCallback((value: string, x: number, width: number) => {
    setTabLayouts((prev) => {
      if (prev[value]?.x === x && prev[value]?.width === width) return prev;
      return { ...prev, [value]: { x, width } };
    });
  }, []);

  const activeLayout = activeValue ? tabLayouts[activeValue] : undefined;

  return (
    <StyledTabList>
      {/* Wrap children to inject onLayout tracking */}
      <View flexDirection="row" position="relative">
        {/* Tab triggers with layout tracking */}
        {Array.isArray(children)
          ? children.map((child) => {
              if (!child || typeof child !== "object" || !("props" in child)) return child;
              const value = child.props?.value;
              if (!value) return child;
              return (
                <View
                  key={value}
                  onLayout={(e: { nativeEvent: { layout: { x: number; width: number } } }) => {
                    const { x, width } = e.nativeEvent.layout;
                    handleTabLayout(value, x, width);
                  }}
                >
                  {child}
                </View>
              );
            })
          : children}

        {/* Underline track (full width subtle line) */}
        <UnderlineTrack />

        {/* Animated underline indicator */}
        {activeLayout && <UnderlineIndicator x={activeLayout.x} width={activeLayout.width} />}
      </View>
    </StyledTabList>
  );
}

// ─── Compound Component Export ───────────────────────────────────────────────

export const SegmentedTabs = Object.assign(SegmentedTabsRoot, {
  List: SegmentedTabList,
  Tab: SegmentedTabTrigger,
  Content: Tabs.Content,
});

export type { SegmentedTabsProps, SegmentedTabListProps, SegmentedTabTriggerProps };
