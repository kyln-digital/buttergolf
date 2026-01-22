"use client";

import React from "react";
import { Row, Column, Input, Text } from "@buttergolf/ui";
import {
  ArrowLeft,
  Search as SearchIcon,
  SlidersHorizontal,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "tamagui";

export interface MobileCategoryHeaderProps {
  categoryName: string;
  onBackPress?: () => void;
  onFilterPress?: () => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
}

/**
 * Mobile category header with back button, search bar, and filter icon.
 * Displays category name below the search bar.
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
  const theme = useTheme();

  const placeholderTextColour =
    theme.textMuted?.val ?? theme.textSecondary?.val ?? theme.text?.val ?? "#999";

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
        <Row
          flex={1}
          height={48}
          backgroundColor="$surface"
          borderRadius="$2xl"
          paddingHorizontal="$4"
          alignItems="center"
          gap="$2"
          borderWidth={1}
          borderColor="$border"
        >
          <SearchIcon size={20} color="$textMuted" opacity={0.7} />
          <Input
            flex={1}
            unstyled
            value={query}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColour}
            fontSize={15}
            color="$text"
            borderWidth={0}
            backgroundColor="transparent"
            height="100%"
          />
        </Row>

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
