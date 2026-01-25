"use client";

import React, { useState } from "react";
import { Column } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchInputField } from "./SearchInputField";

export interface MobileSearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  /**
   * Callback to render search suggestions based on the current query.
   * Return null or undefined to hide suggestions.
   */
  renderSuggestions?: (query: string) => React.ReactNode;
  /**
   * Width percentage of screen (default: 85%)
   */
  widthPercent?: number;
}

/**
 * Mobile-optimized search bar with pill shape and responsive search suggestions.
 * Uses shared SearchInputField for consistent styling.
 */
export function MobileSearchBar({
  placeholder = "What are you looking for?",
  onSearch,
  renderSuggestions,
  widthPercent = 85,
}: Readonly<MobileSearchBarProps>) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const insets = useSafeAreaInsets();

  const handleChangeText = (text: string) => {
    setQuery(text);
    onSearch?.(text);
  };

  const showSuggestions = isFocused && query.length > 0 && renderSuggestions;

  return (
    <Column
      paddingHorizontal="$4"
      paddingTop={insets.top + 16}
      paddingBottom="$3"
      alignItems="center"
    >
      {/* Search Input Container */}
      <Column width={`${widthPercent}%`} alignSelf="center">
        <SearchInputField
          value={query}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          showFocusState
          isFocused={isFocused}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </Column>

      {/* Search Suggestions Dropdown */}
      {showSuggestions && (
        <Column
          width={`${widthPercent}%`}
          alignSelf="center"
          marginTop="$2"
          backgroundColor="$surface"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$border"
          overflow="hidden"
          shadowColor="$shadowColor"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.1}
          shadowRadius={4}
          elevation={3}
        >
          {renderSuggestions(query)}
        </Column>
      )}
    </Column>
  );
}
