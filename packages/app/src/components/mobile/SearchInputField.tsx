"use client";

import React, { useState } from "react";
import { Row, Input } from "@buttergolf/ui";
import { Search as SearchIcon } from "@tamagui/lucide-icons";

export interface SearchInputFieldProps {
  /** Current search query value */
  value: string;
  /** Callback when text changes */
  onChangeText: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show focus state styling */
  showFocusState?: boolean;
  /** Callback when input is focused */
  onFocus?: () => void;
  /** Callback when input loses focus */
  onBlur?: () => void;
  /** Whether the input is currently focused (controlled) */
  isFocused?: boolean;
}

/**
 * Shared search input field component with consistent styling across all mobile search bars.
 * Uses $textSecondary for border, icon, and placeholder for proper visibility.
 */
export function SearchInputField({
  value,
  onChangeText,
  placeholder = "Search...",
  showFocusState = false,
  onFocus,
  onBlur,
  isFocused = false,
}: Readonly<SearchInputFieldProps>) {
  const [internalFocused, setInternalFocused] = useState(false);
  const focused = showFocusState ? isFocused : internalFocused;

  const handleFocus = () => {
    setInternalFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    // Delay to allow clicks to register before blur
    setTimeout(() => {
      setInternalFocused(false);
      onBlur?.();
    }, 200);
  };

  return (
    <Row
      flex={1}
      height={48}
      backgroundColor="$surface"
      borderRadius="$2xl"
      paddingHorizontal="$4"
      alignItems="center"
      gap="$2"
      borderWidth={focused ? 2 : 1}
      borderColor={focused ? "$primary" : "$textSecondary"}
    >
      <SearchIcon size={20} color="$textSecondary" />
      <Input
        flex={1}
        unstyled
        value={value}
        onChange={(e: any) => onChangeText(e.nativeEvent?.text ?? e.target?.value ?? "")}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor="$textSecondary"
        color="$text"
        borderWidth={0}
        backgroundColor="transparent"
        height="100%"
        focusStyle={{
          borderWidth: 0,
          outlineWidth: 0,
        }}
      />
    </Row>
  );
}
