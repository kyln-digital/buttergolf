"use client";

import { useState } from "react";
import { Check, ChevronDown } from "@tamagui/lucide-icons";
import {
  AdaptContents,
  Button,
  Column,
  Popover,
  PopoverAdapt,
  PopoverSheet,
  PopoverSheetFrame,
  PopoverSheetHandle,
  PopoverSheetOverlay,
} from "@buttergolf/ui";

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
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "popular", label: "Most popular" },
];

/**
 * Sort control: a tonal button that opens a small menu (a bottom sheet on
 * touch screens). Built on Popover rather than Select so the option list is
 * never laid out off-screen.
 */
export function SortDropdown({
  value,
  onChange,
  options = DEFAULT_SORT_OPTIONS,
}: Readonly<SortDropdownProps>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <Button
          butterVariant="secondary"
          size="$4"
          iconAfter={ChevronDown}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {`Sort: ${selected?.label ?? "Newest first"}`}
        </Button>
      </Popover.Trigger>

      <PopoverAdapt when="sm">
        <PopoverSheet modal dismissOnSnapToBottom snapPoints={[45]}>
          <PopoverSheetOverlay
            animation="lazy"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <PopoverSheetFrame
            backgroundColor="$background"
            borderTopLeftRadius="$2xl"
            borderTopRightRadius="$2xl"
            padding="$md"
            gap="$sm"
          >
            <PopoverSheetHandle backgroundColor="$border" />
            <AdaptContents />
          </PopoverSheetFrame>
        </PopoverSheet>
      </PopoverAdapt>

      <Popover.Content
        backgroundColor="$background"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$lg"
        padding="$xs"
        elevate
        zIndex={200000}
      >
        <Column role="listbox" aria-label="Sort by" minWidth={220} gap={2}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Button
                key={option.value}
                butterVariant="ghost"
                size="$4"
                width="100%"
                justifyContent="space-between"
                borderRadius="$md"
                role="option"
                aria-selected={isSelected}
                iconAfter={isSelected ? Check : undefined}
                onPress={() => choose(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </Column>
      </Popover.Content>
    </Popover>
  );
}
