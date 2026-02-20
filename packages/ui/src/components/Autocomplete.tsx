"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Column, Row } from "./Layout";
import { Text } from "./Text";
import { Input } from "./Input";
import { Card } from "./Card";
import type { InputProps } from "./Input";

export interface AutocompleteSuggestion {
  id: string | null;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface AutocompleteProps extends Omit<InputProps, "value" | "onChangeText"> {
  value: string;
  onValueChange: (value: string) => void;
  onSelectSuggestion: (suggestion: AutocompleteSuggestion) => void;
  fetchSuggestions: (query: string) => Promise<AutocompleteSuggestion[]>;
  placeholder?: string;
  debounceMs?: number;
  allowCustom?: boolean;
  minChars?: number;
  renderSuggestion?: (suggestion: AutocompleteSuggestion) => React.ReactNode;
}

export function Autocomplete({
  value,
  onValueChange,
  onSelectSuggestion,
  fetchSuggestions,
  placeholder = "Start typing...",
  debounceMs = 300,
  allowCustom = false,
  minChars = 1,
  renderSuggestion,
  ...inputProps
}: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch suggestions with debounce
  const fetchSuggestionsDebounced = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (query.length < minChars) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await fetchSuggestions(query);
          setSuggestions(results);
          setIsOpen(results.length > 0 || allowCustom);
        } catch (error) {
          console.error("Failed to fetch suggestions:", error);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [fetchSuggestions, debounceMs, minChars, allowCustom]
  );

  // Handle input change
  const handleInputChange = (newValue: string) => {
    onValueChange(newValue);
    setSelectedIndex(-1);
    fetchSuggestionsDebounced(newValue);
  };

  // Handle focus - show suggestions immediately
  const handleFocus = () => {
    // Fetch suggestions on focus, even with empty/short value
    if (value.length >= minChars) {
      fetchSuggestionsDebounced(value);
    } else if (minChars === 0) {
      // If minChars is 0, fetch with empty string to show all options
      fetchSuggestionsDebounced("");
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    onValueChange(suggestion.name);
    onSelectSuggestion(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (allowCustom && value.trim()) {
          // Allow custom entry
          handleSelectSuggestion({ id: null, name: value.trim() });
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extract onFocus from inputProps to avoid type conflicts (we use our own handleFocus)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { onFocus: _onFocus, ...restInputProps } = inputProps as {
    onFocus?: unknown;
    [key: string]: unknown;
  };

  return (
    <Column ref={containerRef as any} position="relative" width="100%">
      <div onKeyDown={handleKeyDown}>
        <Input
          value={value}
          onChangeText={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          {...restInputProps}
        />
      </div>

      {/* Dropdown suggestions */}
      {isOpen && (
        <Card
          variant="elevated"
          position="absolute"
          top="100%"
          left={0}
          right={0}
          marginTop="$xs"
          maxHeight={300}
          style={{ overflow: "auto" }}
          zIndex={1000}
          padding="$0"
          backgroundColor="$surface"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$fieldBorder"
        >
          {loading ? (
            <Row padding="$md" justifyContent="center">
              <Text size="$3" color="$textMuted">
                Loading...
              </Text>
            </Row>
          ) : suggestions.length > 0 ? (
            <Column gap="$0">
              {suggestions.map((suggestion, index) => (
                <Row
                  key={suggestion.id || suggestion.name}
                  padding="$md"
                  cursor="pointer"
                  backgroundColor={selectedIndex === index ? "$backgroundHover" : "$surface"}
                  hoverStyle={{
                    backgroundColor: "$backgroundHover",
                  }}
                  onPress={() => handleSelectSuggestion(suggestion)}
                >
                  {renderSuggestion ? (
                    renderSuggestion(suggestion)
                  ) : (
                    <Text size="$4">{suggestion.name}</Text>
                  )}
                </Row>
              ))}
            </Column>
          ) : allowCustom && value.trim() ? (
            <Row
              padding="$md"
              cursor="pointer"
              hoverStyle={{
                backgroundColor: "$backgroundHover",
              }}
              onPress={() => handleSelectSuggestion({ id: null, name: value.trim() })}
            >
              <Text size="$3" color="$textMuted">
                Add &quot;{value}&quot; as new model
              </Text>
            </Row>
          ) : null}
        </Card>
      )}
    </Column>
  );
}
