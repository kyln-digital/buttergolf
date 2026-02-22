"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { styled } from "tamagui";
import type { GetProps } from "tamagui";
import { Text } from "./Text";
import { Row } from "./Layout";

export interface Category {
  name: string;
  href: string;
}

interface CategoryItemRef {
  element: HTMLElement | null;
  width: number;
  left: number;
}

interface CategorySelectorProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange?: (href: string) => void;
  renderItem?: (category: Category, isActive: boolean, isHovered: boolean) => React.ReactNode;
}

// Animated underline indicator (only for active state)
const AnimatedUnderline = styled(Row, {
  name: "AnimatedUnderline",
  position: "absolute",
  bottom: -8, // Position below text without affecting text centering
  left: 0,
  height: 3,
  backgroundColor: "$primary",
  borderRadius: "$full",
  pointerEvents: "none",
});

// Animated hover background box
const AnimatedHoverBox = styled(Row, {
  name: "AnimatedHoverBox",
  position: "absolute",
  top: -6,
  left: 0,
  backgroundColor: "rgba(244, 83, 20, 0.1)",
  borderRadius: "$md",
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — animation in styled() base works at runtime; TS types for styled config don't include it
  animation: "fast",
  pointerEvents: "none",
  paddingHorizontal: "$2",
  paddingVertical: "$1",
});

// Container for the category selector with relative positioning
const CategorySelectorContainer = styled(Row, {
  name: "CategorySelectorContainer",
  position: "relative",
  gap: "$6",
  alignItems: "center",
  justifyContent: "space-around",
  width: "100%",
});

export function CategorySelector({
  categories,
  activeCategory,
  onCategoryChange,
  renderItem,
}: CategorySelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, CategoryItemRef>>({});
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });
  const [hoverBoxStyle, setHoverBoxStyle] = useState({ left: 0, width: 0, height: 0 });

  // Check if user prefers reduced motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Find active category index
  const activeIndex = categories.findIndex((cat) => cat.href === activeCategory);

  // Update underline position (only for active category)
  const updateUnderlinePosition = useCallback(
    (index: number) => {
      if (!containerRef.current) return;

      const category = categories[index];
      if (!category) return;

      const ref = itemRefs.current[category.href];

      if (ref && ref.element) {
        setUnderlineStyle({
          left: ref.left,
          width: ref.width,
        });
      }
    },
    [categories]
  );

  // Update hover box position
  const updateHoverBoxPosition = useCallback(
    (index: number) => {
      if (!containerRef.current) return;

      const category = categories[index];
      if (!category) return;

      const ref = itemRefs.current[category.href];

      if (ref && ref.element) {
        const rect = ref.element.getBoundingClientRect();
        setHoverBoxStyle({
          left: ref.left,
          width: ref.width,
          height: rect.height,
        });
      }
    },
    [categories]
  );

  // Handle hover
  const handleHover = useCallback(
    (index: number) => {
      setHoveredIndex(index);
      updateHoverBoxPosition(index);
    },
    [updateHoverBoxPosition]
  );

  // Handle hover end
  const handleHoverEnd = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Initialize refs and set initial underline position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Collect all category items and their positions
    const items = container.querySelectorAll("[data-category-item]");
    const containerRect = container.getBoundingClientRect();

    items.forEach((item, index) => {
      const category = categories[index];
      if (category) {
        const rect = item.getBoundingClientRect();
        itemRefs.current[category.href] = {
          element: item as HTMLElement,
          width: rect.width,
          left: rect.left - containerRect.left,
        };
      }
    });

    // Set initial underline position to active category
    if (activeIndex >= 0) {
      updateUnderlinePosition(activeIndex);
    }
  }, [categories, activeIndex, updateUnderlinePosition]);

  // Update underline when active category changes
  useEffect(() => {
    if (activeIndex >= 0) {
      updateUnderlinePosition(activeIndex);
    }
  }, [activeIndex, updateUnderlinePosition]);

  return (
    <CategorySelectorContainer ref={containerRef as any}>
      {categories.map((category, index) => {
        const isActive = category.href === activeCategory;
        const isHovered = hoveredIndex === index;

        if (renderItem) {
          return (
            <div
              key={category.href}
              data-category-item
              style={{ position: "relative" }}
              onMouseEnter={() => handleHover(index)}
              onMouseLeave={handleHoverEnd}
              onClick={() => onCategoryChange?.(category.href)}
              role="button"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  onCategoryChange?.(category.href);
                }
              }}
            >
              {renderItem(category, isActive, isHovered)}
            </div>
          );
        }

        return (
          <div
            key={category.href}
            data-category-item
            style={{ position: "relative", cursor: "pointer" }}
            onMouseEnter={() => handleHover(index)}
            onMouseLeave={handleHoverEnd}
            onClick={() => onCategoryChange?.(category.href)}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                onCategoryChange?.(category.href);
              }
            }}
          >
            <Text
              whiteSpace="nowrap"
              userSelect="none"
              color={isActive ? "$primary" : "$text"}
              fontWeight={isActive ? "600" : "400"}
              hoverStyle={{
                color: "$primary",
              }}
            >
              {category.name}
            </Text>
          </div>
        );
      })}

      {/* Animated underline for active category (stays still) */}
      {!prefersReducedMotion && (
        <AnimatedUnderline
          style={
            {
              transform: `translateX(${underlineStyle.left}px)`,
              width: underlineStyle.width,
              opacity: underlineStyle.width > 0 ? 1 : 0,
            } as React.CSSProperties
          }
        />
      )}

      {/* Animated hover box */}
      {!prefersReducedMotion && hoveredIndex !== null && (
        <AnimatedHoverBox
          style={
            {
              transform: `translateX(${hoverBoxStyle.left - 8}px)`,
              width: hoverBoxStyle.width + 16,
              height: hoverBoxStyle.height + 12,
            } as React.CSSProperties
          }
        />
      )}

      {/* Static underline for reduced motion preference */}
      {prefersReducedMotion && (
        <Row
          position="absolute"
          bottom={-8}
          left={underlineStyle.left}
          height={3}
          width={underlineStyle.width}
          backgroundColor="$primary"
          borderRadius="$full"
          pointerEvents="none"
        />
      )}
    </CategorySelectorContainer>
  );
}

export type CategorySelectorProps_Type = GetProps<typeof CategorySelector>;
