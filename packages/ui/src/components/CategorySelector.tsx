"use client";

import type { ReactNode } from "react";
import type { GestureResponderEvent } from "react-native";
import { styled } from "tamagui";
import type { GetProps } from "tamagui";
import { Text } from "./Text";
import { Row } from "./Layout";

export interface Category {
  name: string;
  href: string;
}

interface CategorySelectorProps {
  categories: Category[];
  /** href of the active category ("" when none) */
  activeCategory: string;
  onCategoryChange?: (href: string) => void;
  /** Optional custom renderer; receives active state */
  renderItem?: (category: Category, isActive: boolean) => ReactNode;
}

interface PressLikeEvent {
  preventDefault?: () => void;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  button?: number;
  nativeEvent?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number };
}

/** Modifier clicks (cmd/ctrl/shift, middle button) should keep native link behaviour. */
function isModifiedClick(event: PressLikeEvent): boolean {
  const native = event.nativeEvent ?? {};
  return Boolean(
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    native.metaKey ||
    native.ctrlKey ||
    native.shiftKey ||
    (event.button ?? native.button ?? 0) !== 0
  );
}

/**
 * Category nav item. A real anchor on web (right-click / cmd-click work,
 * crawlable), with client-side navigation via `onCategoryChange`.
 * Hover, press and focus states compile to CSS - no measurement effects.
 */
const CategoryItem = styled(Row, {
  name: "CategoryItem",
  tag: "a",
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
  height: 44,
  paddingHorizontal: 12,
  borderRadius: "$md",
  cursor: "pointer",
  flexShrink: 0,

  hoverStyle: {
    backgroundColor: "$buttonGhostBgHover",
  },
  pressStyle: {
    backgroundColor: "$buttonGhostBgPress",
  },
  focusVisibleStyle: {
    outlineColor: "$primary",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: -2,
  },
});

/** Browser anchors underline their text; the Row renders as <a> on web. */
const anchorReset = { textDecorationLine: "none" } as const;

const CategoryNav = styled(Row, {
  name: "CategoryNav",
  tag: "nav",
  alignItems: "center",
  gap: "$xs",
  width: "100%",
  overflow: "hidden",
});

export function CategorySelector({
  categories,
  activeCategory,
  onCategoryChange,
  renderItem,
}: CategorySelectorProps) {
  return (
    <CategoryNav aria-label="Shop by category">
      {categories.map((category) => {
        const isActive = category.href === activeCategory;

        const handlePress = (gesture: GestureResponderEvent) => {
          const event = gesture as unknown as PressLikeEvent;
          if (!onCategoryChange || isModifiedClick(event)) return;
          event.preventDefault?.();
          onCategoryChange(category.href);
        };

        return (
          <CategoryItem
            key={category.href}
            {...{ href: category.href }}
            aria-current={isActive ? "page" : undefined}
            onPress={handlePress}
            style={anchorReset}
          >
            {renderItem ? (
              renderItem(category, isActive)
            ) : (
              <Text
                size="$4"
                fontWeight={isActive ? "700" : "500"}
                color={isActive ? "$text" : "$textSecondary"}
                whiteSpace="nowrap"
                userSelect="none"
              >
                {category.name}
              </Text>
            )}

            {/* Active indicator - sits on the bar's bottom edge */}
            {isActive && (
              <Row
                position="absolute"
                left={12}
                right={12}
                bottom={0}
                height={2}
                borderRadius="$full"
                backgroundColor="$primary"
                pointerEvents="none"
              />
            )}
          </CategoryItem>
        );
      })}
    </CategoryNav>
  );
}

export type CategorySelectorProps_Type = GetProps<typeof CategorySelector>;
