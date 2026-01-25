"use client";

import React from "react";
import { Row, Column, Text } from "@buttergolf/ui";
import {
  ArrowLeft,
  SlidersHorizontal,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchInputField } from "./SearchInputField";

export interface MobileCategoryHeaderProps {
  categoryName: string;
  onBackPress?: () => void;
  onFilterPress?: () => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
}

/**
 * Mobile category header with back button, search bar, and filter icon.
 * Uses shared SearchInputField for consistent styling.
 */
export function MobileCategoryHeader({
  categoryName,
  onBackPress,
  onFilterPress,
  onSearch,
  placeholder = "Search in category...",
}: Readonly<MobileCategoryHeaderProps>) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState("");

  const handleChangeText = (text: string) => {
    setQuery(text);
    onSearch?.(text);
  };

  return (
    <Column
      paddingHorizontal="$4"
      paddingTop={insets.top + 16}
      paddingBottom="$3"
      gap="$3"
    >
      {/* Header Row with Back Button, Search, and Filter */}
      <Row width="100%" alignItems="center" gap="$3">
        {/* Back Button */}
        <Column
          width={40}
          height={40}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.7 }}
          onPress={onBackPress}
        >
          <ArrowLeft size={24} color="$primary" />
        </Column>

        {/* Search Input */}
        <SearchInputField
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
        />

        {/* Filter Button */}
        <Column
          width={40}
          height={40}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.7 }}
          onPress={onFilterPress}
        >
          <SlidersHorizontal size={24} color="$primary" />
        </Column>
      </Row>

      {/* Category Name */}
      <Text
        size="$6"
        fontWeight="700"
        color="$text"
        alignSelf="flex-start"
      >
        {categoryName}
      </Text>
    </Column>
  );
}
