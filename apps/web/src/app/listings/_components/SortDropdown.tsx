"use client";

import { Check, ChevronDown } from "@tamagui/lucide-icons";
import { Select, Adapt, Sheet } from "tamagui";
import { useMemo } from "react";

export interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options?: SortOption[];
}

const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

export function SortDropdown({
  value,
  onChange,
  options = DEFAULT_SORT_OPTIONS,
}: Readonly<SortDropdownProps>) {
  const selectedLabel = useMemo(() => {
    return options.find((opt) => opt.value === value)?.label || "Sort by";
  }, [value, options]);

  return (
    <Select value={value} onValueChange={onChange} disablePreventBodyScroll>
      <Select.Trigger
        minWidth={200}
        height={40}
        paddingHorizontal="$3"
        borderRadius={10}
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$surface"
        hoverStyle={{ borderColor: "$borderHover" }}
        focusStyle={{ borderColor: "$primary", outlineWidth: 0 }}
        iconAfter={ChevronDown}
      >
        <Select.Value placeholder="Sort by">{selectedLabel}</Select.Value>
      </Select.Trigger>

      <Adapt when="sm" platform="touch">
        <Sheet
          modal
          dismissOnSnapToBottom
          animationConfig={{
            type: "spring",
            damping: 20,
            mass: 1.2,
            stiffness: 250,
          }}
        >
          <Sheet.Frame>
            <Sheet.ScrollView>
              <Adapt.Contents />
            </Sheet.ScrollView>
          </Sheet.Frame>
          <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        </Sheet>
      </Adapt>

      <Select.Content zIndex={200000}>
        <Select.Viewport minWidth={200}>
          <Select.Group>
            {options.map((option, index) => (
              <Select.Item
                key={option.value}
                index={index}
                value={option.value}
                cursor="pointer"
                hoverStyle={{ backgroundColor: "$backgroundHover" }}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator marginLeft="auto">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select>
  );
}
