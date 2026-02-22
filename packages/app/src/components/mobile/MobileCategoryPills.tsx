"use client";

import React from "react";
import { ScrollView, Button } from "@buttergolf/ui";
import type { CategoryDefinition } from "@buttergolf/constants";

export interface MobileCategoryPillsProps {
  categories: readonly CategoryDefinition[];
  selectedCategory: string;
  onCategorySelect: (categoryName: string) => void;
  showAllOption?: boolean;
}

/**
 * Horizontal scrolling category filter pills with active state.
 * Extracted from LoggedOutHomeScreen for reusability.
 */
export function MobileCategoryPills({
  categories,
  selectedCategory,
  onCategorySelect,
  showAllOption = true,
}: Readonly<MobileCategoryPillsProps>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
      }}
    >
      {showAllOption && (
        <Button
          key="all"
          size="$3"
          paddingHorizontal="$4"
          paddingVertical="$2"
          borderRadius="$full"
          backgroundColor="$background"
          borderWidth={1}
          borderColor={selectedCategory === "All" ? "$primary" : "$border"}
          onPress={() => onCategorySelect("All")}
          pressStyle={{ scale: 0.95 }}
        >
          <Button.Text color={selectedCategory === "All" ? "$primary" : "$text"}>All</Button.Text>
        </Button>
      )}

      {categories.map((category) => (
        <Button
          key={category.slug}
          size="$3"
          paddingHorizontal="$4"
          paddingVertical="$2"
          borderRadius="$full"
          backgroundColor="$background"
          borderWidth={1}
          borderColor={selectedCategory === category.name ? "$primary" : "$border"}
          onPress={() => onCategorySelect(category.name)}
          pressStyle={{ scale: 0.95 }}
        >
          <Button.Text color={selectedCategory === category.name ? "$primary" : "$text"}>
            {category.name}
          </Button.Text>
        </Button>
      ))}
    </ScrollView>
  );
}
